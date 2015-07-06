package controllers

import org.opencompare.api.java.impl.PCMFactoryImpl
import org.opencompare.api.java.impl.io.KMFJSONExporter
import org.opencompare.api.java.io.CSVLoader
import play.api.Play.current
import play.api._
import play.api.libs.json._
import play.api.mvc._
import play.libs.XML
import collection.JavaConversions._
import scala.collection.mutable
import scala.io.Source

class Application extends Controller {

  val datasetDir = "datasets/"
  val factory = new PCMFactoryImpl
  val csvOverviewLoader = new CSVLoader(factory, ';', '"', false)
  val jsonExporter = new KMFJSONExporter

  def index = Action {
    Ok(views.html.index())
  }

  def list() = Action { request =>
    val parameters = request.body.asJson.get.asInstanceOf[JsObject]


    val selectedDataset = (parameters \ "dataset").toOption
    val selectedCategory = (parameters \ "category").toOption
    val selectedFilter1 = (parameters \ "filter1").toOption
    val selectedFilter2 = (parameters \ "filter2").toOption

    val datasets = listDirs(datasetDir)

    val categories = if (selectedDataset.isDefined) {
      listDirs(datasetDir + selectedDataset.get.as[String])
    } else {
      List.empty[String]
    }

    val (filters1, filters2, pcms) = if (selectedDataset.isDefined && selectedCategory.isDefined && !selectedFilter1.isDefined) {
      val topLevelDirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String])

      // Detect if there is a filter level
      val firstTopLevelDir = Play.getFile(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + topLevelDirs.head)
      val isPCMLevel = firstTopLevelDir.listFiles().exists(_.getName.endsWith(".xml"))

      if (isPCMLevel) {
        (List.empty[String], List.empty[String], topLevelDirs)
      } else {
        (topLevelDirs, List.empty[String], List.empty[String])
      }
    } else if (selectedDataset.isDefined && selectedCategory.isDefined && selectedFilter1.isDefined && !selectedFilter2.isDefined) {
      val filter1Dirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String])

      val topLevelDirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter1.get.as[String])
      val firstTopLevelDir = Play.getFile(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter1.get.as[String] + "/" + topLevelDirs.head)
      val isPCMLevel = firstTopLevelDir.listFiles().exists(_.getName.endsWith(".xml"))

      if (isPCMLevel) {
        (filter1Dirs, List.empty[String], topLevelDirs)
      } else {
        (filter1Dirs, topLevelDirs, List.empty[String])
      }

    } else if (selectedDataset.isDefined && selectedCategory.isDefined && selectedFilter1.isDefined && selectedFilter2.isDefined) {
      val filter1Dirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String])
      val filter2Dirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter1.get.as[String])
      val pcmDirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter1.get.as[String] + "/" + selectedFilter2.get.as[String])
      (filter1Dirs, filter2Dirs, pcmDirs)
    } else {
      (List.empty[String], List.empty[String], List.empty[String])
    }


    Ok(JsObject(Seq(
      "datasets" -> Json.toJson(datasets),
      "categories" -> Json.toJson(categories),
      "filters1" -> Json.toJson(filters1),
      "filters2" -> Json.toJson(filters2),
      "pcms" -> Json.toJson(pcms)
    )))
  }

  def listDirs(path : String) : List[String] = {
    Play.getFile(path).listFiles().filter(_.isDirectory).map(_.getName).toList
  }

  def load() = Action { request =>
    val parameters = request.body.asJson.get.asInstanceOf[JsObject]

    val selectedDataset = (parameters \ "dataset").toOption
    val selectedCategory = (parameters \ "category").toOption
    val selectedFilter1 = (parameters \ "filter1").toOption
    val selectedFilter2 = (parameters \ "filter2").toOption
    val selectedPCM = (parameters \ "pcm").toOption

    if (selectedPCM.isDefined) {
      val dirPath = if (selectedFilter1.isDefined && selectedFilter2.isDefined) {
        datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter1.get.as[String]  + "/" + selectedFilter2.get.as[String] + "/" + selectedPCM.get.as[String]
      } else if (selectedFilter1.isDefined) {
        datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter1.get.as[String] + "/" + selectedPCM.get.as[String]
      } else {
        datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedPCM.get.as[String]
      }

      val path = dirPath + "/finalPCM.csv"

      val pcmContainers = csvOverviewLoader.load(Play.getFile(path))


      val skuToName = mutable.Map.empty[String, String]

      // Extract overviews from XML dumps
      val overviewFiles = Play.getFile(dirPath).listFiles().filter(_.getName.endsWith(".xml")).toList

      val bestbuyXML = overviewFiles.map{ f =>
        val xml = scala.xml.XML.loadString(Source.fromFile(f).mkString)
        val sku = f.getName.replace(".xml", ".txt")
        var name = (xml \ "name").head.text

        skuToName.put(sku, name)

        name -> xml
      }.toMap

      // Treat XML dumps
      val overviews = bestbuyXML.map { o =>
        val features = o._2.map(xml => xml \ "features" \ "feature").head

        val overview = features.map { node =>
          val text = node.text
          "<strong>" + text.replaceFirst("\n", "</strong><br/>")
        }
        (o._1, overview.mkString("<br/>"))
      }

      val specifications = bestbuyXML.map { bbXML =>
        val specification = (bbXML._2 \ "details" \ "detail").map { detail =>
          val name = (detail \ "name").text
          val value = (detail \ "value").text
          (name, value)
        }
        (bbXML._1, specification)
      }

      // Rename products in PCM
      val pcmContainer = pcmContainers.head
      val pcm = pcmContainer.getPcm
      for (product <- pcm.getProducts) {
        product.setName(skuToName(product.getName))
      }

      // Export to JSON
      val json = jsonExporter.export(pcmContainer)
      val jsonOverviews = JsObject(overviews.toSeq.map(o => o._1 -> JsString(o._2)))
      val jsonSpecifications = JsObject(specifications.toSeq.map(o => o._1 -> JsArray(
        o._2.map(t =>
          JsObject(Seq(
            "feature" -> JsString(t._1),
            "value" -> JsString(t._2)
          )))
      )))

      Ok(JsObject(Seq(
        "pcm" -> Json.parse(json),
        "overviews" -> jsonOverviews,
        "specifications" -> jsonSpecifications
      )))
    } else {
      NotFound("PCM not found")
    }


  }


  def eval = Action {

    // TODO : select a PCM + feature to evaluate

    Ok(views.html.eval())
  }

  def saveEval = Action { request =>

    val evalResults = request.body.asJson
    Logger.info(evalResults.toString)
    // TODO : save results

    Ok("")
  }

}

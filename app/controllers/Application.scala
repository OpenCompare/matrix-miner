package controllers

import java.io.File
import java.net.URI
import java.nio.file.{Files, Path, Paths}
import java.util.stream.Collectors
import javax.inject.Singleton

import model.EvaluationResultRecorder
import org.opencompare.api.java.Feature
import org.opencompare.api.java.impl.PCMFactoryImpl
import org.opencompare.api.java.impl.io.KMFJSONExporter
import org.opencompare.api.java.io.SimpleCSVLoader
import play.api.Play.current
import play.api._
import play.api.libs.json._
import play.api.mvc._

import scala.collection.JavaConversions._
import scala.collection.mutable
import scala.io.Source

@Singleton
class Application extends Controller {

  val evaluationResultRecorder = new EvaluationResultRecorder
  val datasetDir = "datasets/"
  val factory = new PCMFactoryImpl
  val csvOverviewLoader = new SimpleCSVLoader(factory, ';', '"', false)
  val jsonExporter = new KMFJSONExporter

  val featuresToEvaluate : List[(Path, String)] = listFeaturesToEvaluate()
  var indexFeatureToEvaluate = 0

  def isBooleanFeature(feature : Feature) : Boolean = {
    feature.getCells.forall(c => Set("yes", "no").contains(c.getContent.toLowerCase))
  }

  def listFeaturesToEvaluate() : List[(Path, String)] = {
    val datasetPath = Paths.get(datasetDir + "manual-dataset")

    val allFeaturesToEvaluate = for (path <- Files.walk(datasetPath).collect(Collectors.toList()) if path.endsWith("finalPCM.csv")) yield {
      val dir = path.getParent

      try {
        val pcm = csvOverviewLoader.load(Play.getFile(path.toString)).head.getPcm

        val featuresToEvaluateInPCM = for (feature <- pcm.getConcreteFeatures if !isBooleanFeature(feature)) yield {
          (dir, feature.getName)
        }

        featuresToEvaluateInPCM
      } catch {
        case e : NullPointerException =>
          Logger.debug("error loading : " + path.toString)
          Nil
      }

    }

    allFeaturesToEvaluate.flatten.toList
  }

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

      Ok(loadPCM(dirPath))
    } else {
      NotFound("PCM not found")
    }


  }


  def loadPCM(dirPath : String, evaluatedFeatureName : Option[String] = None) : JsValue = {
    val path = dirPath + "/finalPCM.csv"

    val pcmContainers = csvOverviewLoader.load(Play.getFile(path))


    val skuToName = mutable.Map.empty[String, String]

    // Extract overviews from XML dumps
    val overviewFiles = Play.getFile(dirPath).listFiles().filter(_.getName.endsWith(".xml")).toList

    val bestbuyXML = overviewFiles.map{ f =>
      val xml = scala.xml.XML.loadString(Source.fromFile(f).mkString)
      val sku = f.getName.replace(".xml", ".txt")
//      var name = (xml \ "name").head.text
      var name = (xml \ "sku").head.text
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


    val pcmContainer = pcmContainers.head
    val pcm = pcmContainer.getPcm

    // Rename products in PCM
//    for (product <- pcm.getProducts) {
//      product.setName(skuToName(product.getName))
//    }
    for (product <- pcm.getProducts) {
        product.setName(product.getName.substring(0, product.getName.size - 4))
    }

    // Remove features if necessary
    if (evaluatedFeatureName.isDefined) {
      val featuresToRemove = pcm.getConcreteFeatures.filterNot(_.getName == evaluatedFeatureName.get).toList
      featuresToRemove.foreach(pcm.removeFeature(_))

      for (product <- pcm.getProducts) {
        for (cell <- product.getCells) {
          if (featuresToRemove.contains(cell.getFeature)) {
            product.removeCell(cell)
          }
        }
      }
    }

    // Check uniqueness of features and products
    val productNames = pcm.getProducts.map(_.getName).toList
    if (productNames.size > productNames.distinct.size) {
      Logger.debug("product names are not unique")
    }

    val featureNames = pcm.getConcreteFeatures.map(_.getName)
    val duplicatedNames = featureNames.groupBy(f => f).filter(_._2.size > 1).map(_._1).toList
    if (duplicatedNames.nonEmpty) {
      Logger.debug("feature names are not unique")
      Logger.debug(duplicatedNames.mkString(","))
    }

    // Remove duplicated features
    for (duplicatedName <- duplicatedNames) {
      val duplicatedFeature = pcm.getConcreteFeatures.find(_.getName == duplicatedName)
      if (duplicatedFeature.isDefined) {
        pcm.removeFeature(duplicatedFeature.get)
      }
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

    JsObject(Seq(
      "pcm" -> Json.parse(json),
      "overviews" -> jsonOverviews,
      "specifications" -> jsonSpecifications
    ))
  }

  def eval = Action {

    // Select a PCM to evaluate
    val (dirPath, evaluatedFeatureName) = this.synchronized {
      val featureToEvaluate = featuresToEvaluate.get(indexFeatureToEvaluate)
      indexFeatureToEvaluate += 1
      if (indexFeatureToEvaluate == featuresToEvaluate.size) {
        indexFeatureToEvaluate = 0
      }
      featureToEvaluate
    }

    Logger.info("evaluating : " + dirPath.toString + " - " + evaluatedFeatureName)
    Ok(views.html.eval(dirPath.toString, evaluatedFeatureName))
  }

  def loadEval(dirPath : String, evaluatedFeatureName : String) = Action {
    val decodedDirPath = new URI(dirPath).getPath
    val pcmPath = decodedDirPath + "/finalPCM.csv"

    Logger.info("loading : " + pcmPath)

    if (new File(pcmPath).exists()) {
      Ok(loadPCM(decodedDirPath, Some(evaluatedFeatureName)))
    } else {
      NotFound("PCM not found")
    }

  }

  def saveEval = Action { request =>

    val evalResults = request.body.asJson
    if (evalResults.isDefined) {
      evaluationResultRecorder.record(evalResults.get)
      Ok("")
    } else {
      BadRequest("")
    }

  }

  def extractFeatureResults = Action {
    val results = evaluationResultRecorder.getFeatureResults()
    val resultsInCSV = results.map(_.mkString(",")).mkString("\n")
    Ok(resultsInCSV).as("application/x-download")
  }

  def extractCellResults = Action {
    val results = evaluationResultRecorder.getCellResults()
    val resultsInCSV = results.map(_.mkString(",")).mkString("\n")
    Ok(resultsInCSV).as("application/x-download")
  }

  def template(file : String) = Assets.at("/public/templates", file)

}

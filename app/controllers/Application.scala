package controllers

import org.opencompare.api.java.impl.PCMFactoryImpl
import org.opencompare.api.java.impl.io.KMFJSONExporter
import org.opencompare.api.java.io.CSVLoader
import play.api.Play.current
import play.api._
import play.api.libs.json._
import play.api.mvc._
import collection.JavaConversions._

class Application extends Controller {

  val datasetDir = "datasets/"
  val factory = new PCMFactoryImpl
  val csvOverviewLoader = new CSVLoader(factory, ';', '"', false)
  val jsonExporter = new KMFJSONExporter

  def index = Action {

    Ok(views.html.index())
    //Ok(views.html.index(">"))
  }

  def list() = Action { request =>
    val parameters = request.body.asJson.get.asInstanceOf[JsObject]


    val selectedDataset = (parameters \ "dataset").toOption
    val selectedCategory = (parameters \ "category").toOption
    val selectedFilter = (parameters \ "filter").toOption

    val datasets = listDirs(datasetDir)

    val categories = if (selectedDataset.isDefined) {
      listDirs(datasetDir + selectedDataset.get.as[String])
    } else {
      List.empty[String]
    }

    val (filters, pcms) = if (selectedDataset.isDefined && selectedCategory.isDefined && !selectedFilter.isDefined) {
      val topLevelDirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String])

      // Detect if there is a filter level
      val firstTopLevelDir = Play.getFile(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + topLevelDirs.head)
      val isPCMLevel = firstTopLevelDir.listFiles().exists(_.getName.endsWith(".txt"))

      if (isPCMLevel) {
        (List.empty[String], topLevelDirs)
      } else {
        (topLevelDirs, List.empty[String])
      }
    } else if (selectedDataset.isDefined && selectedCategory.isDefined && selectedFilter.isDefined) {
      val filterDirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String])
      val pcmDirs = listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter.get.as[String])

      (filterDirs, pcmDirs)
    } else {
      (List.empty[String], List.empty[String])
    }


    Ok(JsObject(Seq(
      "datasets" -> Json.toJson(datasets),
      "categories" -> Json.toJson(categories),
      "filters" -> Json.toJson(filters),
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
    val selectedFilter = (parameters \ "filter").toOption
    val selectedPCM = (parameters \ "pcm").toOption

    if (selectedPCM.isDefined) {
      val dirPath = if (selectedFilter.isDefined) {
        datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedFilter.get.as[String] + "/" + selectedPCM.get.as[String]
      } else {
        datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String] + "/" + selectedPCM.get.as[String]
      }

      val path = dirPath + "/finalPCM.csv"

      val pcm = csvOverviewLoader.load(Play.getFile(path))
      val json = jsonExporter.export(pcm)

      Ok(Json.parse(json))
    } else {
      NotFound("PCM not found")
    }


  }

}

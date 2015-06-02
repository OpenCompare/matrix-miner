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
    val selectedPCM = (parameters \ "pcm").toOption


    val datasets = listDirs(datasetDir)

    val categories = if (selectedDataset.isDefined) {
      listDirs(datasetDir + selectedDataset.get.as[String])
    } else {
      List.empty[String]
    }

    val filters = List.empty[String]

    val pcms = if (selectedDataset.isDefined && selectedCategory.isDefined) {
      listDirs(datasetDir + selectedDataset.get.as[String] + "/" + selectedCategory.get.as[String])
    } else {
      List.empty[String]
    }


    Ok(JsObject(Seq(
      "datasets" -> Json.toJson(datasets),
      "categories" -> Json.toJson(categories),
      "filters" -> Json.toJson(filters),
      "pcms" -> Json.toJson(pcms)
    )))
  }

  def listDirs(path : String) : List[String] = {
    println(path)
    Play.getFile(path).listFiles().filter(_.isDirectory).map(_.getName).toList
  }

  def load() = Action { request =>
    val parameters = request.body.asJson.get.asInstanceOf[JsObject]


    val selectedDataset = (parameters \ "dataset").toOption
    val selectedCategory = (parameters \ "category").toOption
    val selectedFilter = (parameters \ "filter").toOption
    val selectedPCM = (parameters \ "pcm").toOption

    val pcm = csvOverviewLoader.load(Play.getFile(datasetDir + "clustering-dataset/All Printers/cluster_8/finalPCM.csv"))
    val json = jsonExporter.export(pcm)

    Ok(Json.parse(json))
  }

}

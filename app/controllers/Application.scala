package controllers

import java.io.File


import java.io

import org.opencompare.api.java.impl.io.KMFJSONExporter

import collection.JavaConversions._

import org.opencompare.api.java.PCM
import org.opencompare.api.java.impl.PCMFactoryImpl
import org.opencompare.api.java.io.CSVLoader

import play.api._
import play.api.libs.json._
import play.api.mvc._

import play.api.Play.current



import scala.reflect.io.File

class Application extends Controller {

  val factory = new PCMFactoryImpl
  val datasetDir = "datasets/"
  val workspaceDir = "datasets/"


  def index = Action {

    Ok(views.html.index())
    //Ok(views.html.index(">"))
  }

  def category(fileRoot: String) = Action {

    val fileLocation = workspaceDir + fileRoot

    val files = play.api.Play.getFile(fileLocation).listFiles()
      .filter(f => f.isDirectory)
    //      .sortBy(f => mkProperName(f))

    val r = for (d <- files) yield d.getName
    Ok(Json.toJson(Map("subcats" -> r)))
  }




  def _fileListToJSON(file : io.File) : JsValue  = {
    if (!file.isDirectory()) {
      if (""".*\.fml$""".r.findFirstIn(file.getName).isDefined ||
        """.*\.dimacs$""".r.findFirstIn(file.getName).isDefined
      ){
        Json.toJson(Map ("label" -> Json.toJson(file.getName()),
          "leaf" -> JsBoolean(true),
          //add name
          //"name" -> JsString(file.getName()),
          //
          "type" -> JsString("file"),
          "id" -> JsString("fml" + file.getName()))) //"fml" + file.getName())) mkProperName(file)))
      }else{
        JsNull
      }

    }
    else {
      val files = file.listFiles
      if (!files.isEmpty) {
        val json = files.map(f =>
          _fileListToJSON(f)
        )
        // "children:" + json.filter(j => !j.isInstanceOf[JsNull]).map() + " label:" + file.getName()
        //json.map(j => Json.toJson(j)) // filter(j => !j.isInstanceOf[JsNull]).
        Json.toJson(Map ("label" -> Json.toJson(file.getName()),
          //add name
          //"name" -> JsString(file.getName()),
          //
          "children" -> JsArray(json.filter(j => j match {case JsNull => false; case _ => true})),
          "expanded" -> JsBoolean(true)
        ))
      }
      else {
        Json.toJson(Map ("label" -> Json.toJson(file.getName()),
          "type" -> JsString("io")
        )
        )
      }
    }
  }

  // print the parent directory name if the parent directory is not the root of the workspace (relative)
  // FIXME
  def mkProperName(f : io.File) = {
    f.getAbsolutePath // .replaceFirst(workspaceDir, "")
  }

  def recursiveListFiles(f: io.File): Array[io.File] = {
    val these = f.listFiles
    these ++ these.filter(_.isDirectory).flatMap(recursiveListFiles)
  }



  def getPCM(id : String) = Action {
    val csvOverviewLoader = new CSVLoader(factory, ';', '"', false)
    val pcm = csvOverviewLoader.load(new io.File(datasetDir + "clustering-dataset/All Printers/cluster_8/finalPCM.csv"))
    val jsonExporter = new KMFJSONExporter
    val json = jsonExporter.export(pcm)
    Ok(Json.parse(json))
  }
}

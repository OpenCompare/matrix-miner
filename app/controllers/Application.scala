package controllers

import java.io.File


import controllers.PCMCatalog._
import play.api._
import play.api.libs.json._
import play.api.mvc._

import play.api.Play.current

class Application extends Controller {


  val workspaceDir = "dataset-best-buy/manual-dataset/"

  def index = Action {

    Ok(views.html.index())
    //Ok(views.html.index(">"))
  }

  def category(fileRoot: Option[String]) = Action {
    val f =  fileRoot match {
      case Some(fileRoot) => fileRoot
      case None => ""
    }

    val fileLocation = workspaceDir + f.toString

    val files = play.api.Play.getFile(fileLocation).listFiles()
      .filter(f => f.isDirectory)
    //      .sortBy(f => mkProperName(f))

    val r = for (d <- files) yield d.getName
    Ok(Json.toJson(Map("subcats" -> r)))
  }




  def _fileListToJSON(file : File) : JsValue  = {
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
  def mkProperName(f : File) = {
    f.getAbsolutePath // .replaceFirst(workspaceDir, "")
  }

  def recursiveListFiles(f: File): Array[File] = {
    val these = f.listFiles
    these ++ these.filter(_.isDirectory).flatMap(recursiveListFiles)
  }



}

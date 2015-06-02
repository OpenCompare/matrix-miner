package controllers

import org.opencompare.api.java.PCM
import play.api._
import play.api.libs.json._
import play.api.mvc._

class Application extends Controller {

  def index = Action {
    Ok(views.html.index())
  }


  def getPCM(id : String) = Action {
    Ok(Json.toJson(""))
  }
}

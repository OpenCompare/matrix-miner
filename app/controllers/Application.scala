package controllers

import java.io

import org.opencompare.api.java.impl.io.KMFJSONExporter

import collection.JavaConversions._

import org.opencompare.api.java.PCM
import org.opencompare.api.java.impl.PCMFactoryImpl
import org.opencompare.api.java.io.CSVLoader
import play.api._
import play.api.libs.json._
import play.api.mvc._

import scala.reflect.io.File

class Application extends Controller {

  val factory = new PCMFactoryImpl
  val datasetDir = "datasets/"

  def index = Action {
    Ok(views.html.index())
  }


  def getPCM(id : String) = Action {
    val csvOverviewLoader = new CSVLoader(factory, ';', '"', false)
    val pcm = csvOverviewLoader.load(new io.File(datasetDir + "clustering-dataset/All Printers/cluster_8/finalPCM.csv"))
    val jsonExporter = new KMFJSONExporter
    val json = jsonExporter.export(pcm)
    Ok(Json.parse(json))
  }
}

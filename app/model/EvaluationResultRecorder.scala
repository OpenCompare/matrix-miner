package model

import java.util.Base64

import com.mongodb.DBObject
import com.mongodb.casbah.MongoClient
import com.mongodb.util.JSON
import play.api.Logger
import play.api.libs.json.{Json, JsValue}
import com.mongodb.casbah.Imports._

/**
 * Created by gbecan on 7/8/15.
 */
class EvaluationResultRecorder {

  val mongoClient = MongoClient("localhost", 27017)
  val db = mongoClient("matrix-miner")
  val records = db("evalRecords")

  val base64Decoder = Base64.getDecoder

  def record(result : JsValue) {
    Logger.info(result.toString())
    val dbObject = JSON.parse(Json.stringify(result)).asInstanceOf[DBObject]
    records.insert(dbObject)
  }

  def getFeatureResults(): List[List[String]] = {
    val queryResults = records.find(MongoDBObject())

    val results = (for (queryResult <- queryResults) yield {

      val pcmName = queryResult.get("pcm").toString

      val feature = queryResult.get("feature").asInstanceOf[DBObject]
      val featureName = feature.get("name").toString
//      val decodedFeatureName = new String(base64Decoder.decode(featureName))

      val eval = feature.get("eval").toString
      val correctValueOption = Option(feature.get("correct").asInstanceOf[String])
      val correctValue = correctValueOption.getOrElse("")
      val overVsSpec = feature.get("overVsSpec").toString

      List(pcmName, featureName, eval, correctValue, overVsSpec)

    }).toList

    List("pcm", "feature name", "evaluation", "correct value", "overVsSpec") :: results
  }

  def getCellResults() : List[List[String]] = {
    val queryResults = records.find(MongoDBObject())

    val results = (for (queryResult <- queryResults) yield {

      val pcmName = queryResult.get("pcm").toString

      val feature = queryResult.get("feature").asInstanceOf[DBObject]
      val featureName = feature.get("name").toString

      val cells = queryResult.get("cells").asInstanceOf[BasicDBList]
      val cellResults = for (dbCell <- cells) yield {
        val cell = dbCell.asInstanceOf[DBObject]

        val productName = cell.get("product").toString

        val eval = cell.get("eval").toString
        val correctValueOption = Option(cell.get("correct").asInstanceOf[String])
        val correctValue = correctValueOption.getOrElse("")
        val overVsSpec = cell.get("overVsSpec").toString

        List(pcmName, featureName, productName, eval, correctValue, overVsSpec)
      }
      cellResults
    }).toList.flatten

    List("pcm", "feature name", "product name", "eval", "correct value", "overVsSpec") :: results
  }

}

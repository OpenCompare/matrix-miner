package model

import com.mongodb.DBObject
import com.mongodb.casbah.MongoClient
import com.mongodb.util.JSON
import play.api.Logger
import play.api.libs.json.{Json, JsValue}

/**
 * Created by gbecan on 7/8/15.
 */
class EvaluationResultRecorder {

  val mongoClient = MongoClient("localhost", 27017)
  val db = mongoClient("matrix-miner")
  val records = db("evalRecords")

  def record(result : JsValue) {
    Logger.info(result.toString())
    val dbObject = JSON.parse(Json.stringify(result)).asInstanceOf[DBObject]
    records.insert(dbObject)
  }

}

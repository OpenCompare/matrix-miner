package model

import play.api.Logger
import play.api.libs.json.JsValue

/**
 * Created by gbecan on 7/8/15.
 */
class EvaluationResultRecorder {

  def record(result : JsValue) {
    Logger.info(result.toString())
  }

}

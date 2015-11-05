name := """matrix-miner"""

version := "1.0-SNAPSHOT"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

scalaVersion := "2.11.6"

libraryDependencies ++= Seq(

  "org.webjars" %% "webjars-play" % "2.4.0",
  "org.webjars" % "bootstrap" % "3.2.0",
  "org.webjars" % "angularjs" % "1.3.0",
  "org.webjars" % "angular-ui-bootstrap" % "0.13.0",
  "org.webjars" % "angular-translate" % "2.7.2",
  "org.webjars" % "font-awesome" % "4.4.0",
  "org.webjars" % "ui-grid" % "3.0.1",
  "org.webjars" % "bootstrap-material-design" % "0.3.0",
  "org.webjars" % "jquery-ui" % "1.11.4",
  "org.webjars" % "jquery-ui-themes" % "1.11.4",
  "org.webjars" % "angular-chart.js" % "0.7.1",

  "org.webjars.bower" % "angular-utf8-base64" % "0.0.5"
    exclude("org.webjars.bower", "angular"),

  "org.webjars.bower" % "angular-base64-upload" % "0.1.8"
    exclude("org.webjars.bower", "angular"),

  "org.webjars.bower" % "angular-ui-slider" % "0.1.1"
    exclude("org.webjars.bower", "angular")
    exclude("org.webjars.bower", "jquery"),

//  "org.webjars.bower" % "opencompare-editor" % "0.1.1"
//    exclude("org.webjars.bower", "angular")
//    exclude("org.webjars.bower", "angular-translate")
//    exclude("org.webjars.bower", "angular-chart.js")
//    exclude("org.webjars.bower", "jquery")
//    exclude("org.webjars.bower", "jquery-ui")
//    exclude("org.webjars.bower", "ui-grid")
//    exclude("org.webjars.bower", "bootstrap")
//    exclude("org.webjars.bower", "arrive")
//    exclude("org.webjars.bower", "fontawesome"),


//  "org.webjars" % "angular-highlightjs" % "0.3.2-1",

  "org.mongodb" %% "casbah" % "2.8.1",

  "org.opencompare" % "model" % "0.6",
  "org.opencompare" % "api-java" % "0.6",
  "org.opencompare" % "api-java-impl" % "0.6",

  jdbc,
  cache,
  ws,
  specs2 % Test
)

resolvers += "scalaz-bintray" at "http://dl.bintray.com/scalaz/releases"
resolvers += "Local Maven Repository" at "file://"+Path.userHome.absolutePath+"/.m2/repository"

// Play provides two styles of routers, one expects its actions to be injected, the
// other, legacy style, accesses its actions statically.
routesGenerator := InjectedRoutesGenerator

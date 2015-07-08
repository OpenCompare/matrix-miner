name := """matrix-miner"""

version := "1.0-SNAPSHOT"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

scalaVersion := "2.11.6"

libraryDependencies ++= Seq(
  "org.webjars" %% "webjars-play" % "2.4.0-1",
  "org.webjars" % "bootstrap" % "3.2.0",
  "org.webjars" % "angularjs" % "1.4.0",
  "org.webjars" % "angular-ui-bootstrap" % "0.13.0",
  "org.webjars" % "jquery-ui" % "1.11.4",
  "org.webjars" % "jquery-ui-themes" % "1.11.4",
  "org.webjars" % "font-awesome" % "4.3.0-1",
  "org.webjars" % "ui-grid" % "3.0.0-rc.22",
  "org.kevoree.modeling" % "org.kevoree.modeling.microframework" % "3.5.12",
  "com.opencsv" % "opencsv" % "3.3",
  "org.webjars" % "angular-translate" % "2.7.2",
  "org.webjars" % "angular-highlightjs" % "0.3.2-1",
  "org.webjars" % "bootstrap-material-design" % "0.3.0",
  "org.opencompare" % "model" % "0.4-SNAPSHOT",
  "org.opencompare" % "api-java" % "0.4-SNAPSHOT",
  "org.opencompare" % "api-java-impl" % "0.4-SNAPSHOT",
  "org.webjars.bower" % "angular-utf8-base64" % "0.0.5" exclude("org.webjars.bower", "angular"),
  "org.mongodb" %% "casbah" % "2.8.1",
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

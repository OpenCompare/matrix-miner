name := """matrix-miner"""

version := "1.0-SNAPSHOT"

lazy val root = (project in file(".")).enablePlugins(PlayScala)

scalaVersion := "2.11.6"

libraryDependencies ++= Seq(
  "org.webjars" %% "webjars-play" % "2.4.0-1",
  "org.webjars" % "bootstrap" % "3.2.0",
  "org.webjars" % "angularjs" % "1.4.0",
  "org.webjars" % "font-awesome" % "4.3.0-1",
  "org.webjars" % "ui-grid" % "3.0.0-rc.21",
  "org.kevoree.modeling" % "org.kevoree.modeling.microframework" % "3.5.12",
  "com.opencsv" % "opencsv" % "3.3",
  jdbc,
  cache,
  ws,
  specs2 % Test
)

resolvers += "scalaz-bintray" at "http://dl.bintray.com/scalaz/releases"

// Play provides two styles of routers, one expects its actions to be injected, the
// other, legacy style, accesses its actions statically.
routesGenerator := InjectedRoutesGenerator

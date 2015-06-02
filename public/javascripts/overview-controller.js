/**
 * Created by gbecan on 6/2/15.
 */

matrixMinerApp.controller("OverviewController", function($rootScope, $scope, $http) {

    $scope.message = "toto";
    $scope.category = "";
    $scope.subcategories = [];

    $scope.overviews = ["toto", "tata"];

    $scope.search = function(cell, feature) {

    }

    $scope.upd = function (categ) {
            $scope.category = categ;

            $http.get("/category/" + categ).success(function (data) {
                $scope.subcategories = data['subcats'];
            });
    }
});
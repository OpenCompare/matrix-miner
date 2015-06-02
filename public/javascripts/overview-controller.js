/**
 * Created by gbecan on 6/2/15.
 */

matrixMinerApp.controller("OverviewController", function($rootScope, $scope, $http) {

    $scope.category = "";
    $scope.subcategories = [];

    $scope.overviews = {
        "8115038.txt" : "bla bla YES",
        "1624811.txt" : "bla bla NO"
    };

    $scope.text = "";

    $scope.search = function(cell, feature) {

    };

    $scope.upd = function (categ) {
            $scope.category = categ;

            $http.get("/category/" + categ).success(function (data) {
                $scope.subcategories = data['subcats'];
            });
    };

    $scope.$on('selection', function(event, product, feature, cell) {
        console.log(product + ", " + feature + " : " + cell);
        $scope.text = $scope.overviews[product];
        $scope.keywords = feature + ", " + cell;
    });

});
/**
 * Created by gbecan on 6/2/15.
 */

matrixMinerApp.controller("OverviewController", function($rootScope, $scope, $http) {

    $scope.overviews = {
        "8115038.txt" : "bla bla YES",
        "1624811.txt" : "bla bla NO"
    };

    $scope.text = "";

    $scope.search = function(cell, feature) {

    };

    $scope.$on('selection', function(event, product, feature, cell) {
        console.log(product + ", " + feature + " : " + cell);
        $scope.text = $scope.overviews[product];
        $scope.keywords = feature + ", " + cell;
    });

});
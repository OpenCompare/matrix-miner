/**
 * Created by gbecan on 6/2/15.
 */

matrixMinerApp.controller("OverviewController", function($rootScope, $scope, $http) {

    $scope.message = "toto";
  

    $scope.overviews = ["toto", "tata"];

    $scope.search = function(cell, feature) {

    }

    $scope.$on('selection', function(event, product, feature, cell) {
        console.log(product + ", " + feature + " : " + cell);
    });

});
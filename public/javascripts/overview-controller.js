/**
 * Created by gbecan on 6/2/15.
 */

matrixMinerApp.controller("OverviewController", function($rootScope, $scope, $http) {

    $scope.overviews = {};

    $scope.text = "";

    $scope.$on('selection', function(event, product, feature, cell) {
        $scope.text = $scope.overviews[product];
        $scope.keywords = feature + ", " + cell;
    });

    $scope.$on('overviews', function(event, data) {
        $scope.overviews = data;
    });

});
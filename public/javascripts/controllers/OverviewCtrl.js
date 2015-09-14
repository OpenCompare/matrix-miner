/**
 * Created by gbecan on 6/2/15.
 */

angular
    .module("matrixMinerApp")
    .controller("OverviewController", function($rootScope, $scope) {

    $scope.overviews = {};

    $scope.text = "";

    $scope.$on('selection', function(event, product, feature, cell) {
        $scope.text = $scope.overviews[product];
        if (cell === "YES" || cell === "NO" || /^\s*$/.test(cell)) {
            $scope.keywords = feature;
        } else {
            $scope.keywords = feature + ", " + cell;
        }
    });

    $scope.$on('overviews', function(event, data) {
        $scope.overviews = data;
    });

});
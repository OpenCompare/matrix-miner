/**
 * Created by gbecan on 6/2/15.
 */

matrixMinerApp.controller("OverviewController", function($rootScope, $scope, $http, expandeditor) {

    $scope.overviews = {};

    $scope.text = "";

    function displayData(newRowCol, oldRowCol) {
        var feature = newRowCol.col.name;
        var product = newRowCol.row.entity.name;
        var cell = newRowCol.row.entity[newRowCol.col.name];

        $scope.text = $scope.overviews[product];
        if (cell === "YES" || cell === "NO") {
            $scope.keywords = feature;
        } else {
            $scope.keywords = feature + ", " + cell;
        }
    }

    $scope.$on('overviews', function(event, data) {
        $scope.overviews = data;
    });

    expandeditor.expandNavigateFunctions(displayData).addFunction();
});
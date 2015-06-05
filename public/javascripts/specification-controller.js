/**
 * Created by gbecan on 6/5/15.
 */


matrixMinerApp.controller("SpecificationController", function($rootScope, $scope, $http) {

    $scope.specifications = {};
    $scope.specification = [];
    $scope.selectedFeature = "";

    $scope.$on('selection', function(event, product, feature, cell) {
        $scope.specification = $scope.specifications[product];
        $scope.selectedFeature = feature;
    });

    $scope.$on('specifications', function(event, specifications) {
        $scope.specifications = specifications;
    });

    $scope.filterFeature = function (row) {
        var f1 = $scope.selectedFeature.toLowerCase();
        var f2 = row.feature.toLowerCase();
        var isInSpecif = (f1.indexOf(f2) > -1) || (f2.indexOf(f1) > -1);
        return isInSpecif;
    }

});
/**
 * Created by gbecan on 6/5/15.
 */


matrixMinerApp.controller("SpecificationController", function($rootScope, $scope, $http) {

    $scope.specifications = {};
    $scope.specification = {};

    $scope.$on('selection', function(event, product, feature, cell) {
        $scope.specification = $scope.specifications[product];

    });

    $scope.$on('specifications', function(event, specifications) {
        $scope.specifications = specifications;
    });

});
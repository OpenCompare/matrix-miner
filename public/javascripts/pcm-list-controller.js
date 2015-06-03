
matrixMinerApp.controller("PCMListController", function($rootScope, $scope, $http) {

    $scope.datasets = [];
    $scope.categories = [];
    $scope.filters = [];
    $scope.pcms = [];


    $scope.list = function() {
        var postData = {
            dataset: $scope.selectedDataset,
            category: $scope.selectedCategory,
            filter: $scope.selectedFilter
        };
        $http.post("/list", postData).success(function (data) {
            $scope.datasets = data.datasets;
            $scope.categories = data.categories;
            $scope.filters = data.filters;
            $scope.pcms = data.pcms;
        });
    };

    $scope.load = function() {
        var postData = {
            dataset: $scope.selectedDataset,
            category: $scope.selectedCategory,
            filter: $scope.selectedFilter,
            pcm: $scope.selectedPCM
        };
        $http.post("/load", postData).success(function (data) {
            console.log(data);
        });
    };

    $scope.list();

});
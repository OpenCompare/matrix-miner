
matrixMinerApp.controller("PCMListController", function($rootScope, $scope, $http, opencompareinitializer) {

    $scope.datasets = [];
    $scope.categories = [];
    $scope.filters1 = [];
    $scope.filters2 = [];
    $scope.pcms = [];

    $scope.list = function(level) {

        delete $scope.selectedPCM;

        if (level === "dataset") {
            delete $scope.selectedCategory;
            delete $scope.selectedFilter1;
            delete $scope.selectedFilter2;
        } else if (level === "category") {
            delete $scope.selectedFilter1;
            delete $scope.selectedFilter2;
        } else if (level === "filter1") {
            delete $scope.selectedFilter2;
        }

        var postData = {
            dataset: $scope.selectedDataset,
            category: $scope.selectedCategory,
            filter1: $scope.selectedFilter1,
            filter2: $scope.selectedFilter2
        };
        $http.post("/list", postData).success(function (data) {
            $scope.datasets = data.datasets;
            $scope.categories = data.categories;
            $scope.filters1 = data.filters1;
            $scope.filters2 = data.filters2;
            $scope.pcms = data.pcms;
        });
    };

    $scope.load = function() {
        var postData = {
            dataset: $scope.selectedDataset,
            category: $scope.selectedCategory,
            filter1: $scope.selectedFilter1,
            filter2: $scope.selectedFilter2,
            pcm: $scope.selectedPCM
        };
        $http.post("/load", postData).success(function (data) {
            //$rootScope.$broadcast("pcm", data.pcm);
            $scope.myData = data;
            opencompareinitializer.initialize(data);
            $rootScope.$broadcast("overviews", data.overviews);
            $rootScope.$broadcast("specifications", data.specifications);
        });
    };

    $scope.list();

});
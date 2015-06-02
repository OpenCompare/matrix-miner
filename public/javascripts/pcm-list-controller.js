
matrixMinerApp.controller("PCMListController", function($rootScope, $scope, $http) {

    $scope.datasets = [];
    $scope.categories = [];
    $scope.filters = [];
    $scope.pcms = [];


    $scope.list = function() {
        var postData = {
            dataset: $scope.selectedDataset,
            category: $scope.selectedCategory,
            filter: $scope.selectedFilter,
            pcm: $scope.selectedPCM
        };
        $http.post("/list", postData).success(function (data) {
            $scope.datasets = data.datasets;
            $scope.categories = data.categories;
            $scope.filters = data.filters;
            $scope.pcms = data.pcms;
        });
    }

    $scope.list();

   //$scope.category = "> ";
   //$scope.subcategories = [];
   //
   //$scope.upd = function (categ, subcateg) {
   //     $scope.category = categ + "/" + subcateg;
	//var cat = "";
   //     if (categ == "" || categ == "> ") {
	//}
   //     else {
   //         cat = categ + "/";
	//}
   //     $http.get("/category/" + cat + subcateg).success(function (data) {
   //             $scope.subcategories = data['subcats'];
   //         });
   // }
   //
   // $scope.updRoot = function (categ) {
	//
	//    $http.get("/categoryRoot").success(function (data) {
   //             $scope.subcategories = data['subcats'];
   //         });
   // }

});
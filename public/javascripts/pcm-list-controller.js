
matrixMinerApp.controller("PCMListController", function($rootScope, $scope, $http) {

   $scope.category = "> ";
   $scope.subcategories = [];

   $scope.upd = function (categ, subcateg) {
        $scope.category = categ + "/" + subcateg;
	var cat = "";
        if (categ == "" || categ == "> ") {
	}
        else {
            cat = categ + "/";
	}
        $http.get("/category/" + cat + subcateg).success(function (data) {
                $scope.subcategories = data['subcats'];
            });
    }

    $scope.updRoot = function (categ) {
	
	    $http.get("/categoryRoot").success(function (data) {
                $scope.subcategories = data['subcats'];
            });
    }

});
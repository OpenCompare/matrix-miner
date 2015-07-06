/**
 * Created by gbecan on 7/6/15.
 */

matrixMinerApp.controller("EvalCtrl", function($rootScope, $scope, $http, $window) {

    $scope.completed = false;

    $scope.send = function() {

        var evalResults = {
            "pcm" : "id"
        };

        $http.post("/eval/save", evalResults).success(function (data) {
            $window.location.reload();
        });
    }

});
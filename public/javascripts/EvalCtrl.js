/**
 * Created by gbecan on 7/6/15.
 */

matrixMinerApp.controller("EvalCtrl", function($rootScope, $scope, $http, $window) {

    $scope.completed = false;

    $scope.feature = {
        name: "feature"
    };

    $scope.cells = [
        {
            name: "cell1"
        },
        {
            name: "cell2"
        },
        {
            name: "cell3"
        }
    ];

    $scope.send = function() {

        var evalResults = {
            pcm : "id",
            feature : $scope.feature,
            cells : $scope.cells
        };

        $http.post("/eval/save", evalResults)
            .success(function (data) {
                $window.location.reload();
            })
            .error(function (data) {
                console.log("an error occured while sending evaluation results")
            });
    }

});
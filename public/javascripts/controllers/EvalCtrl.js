/**
 * Created by gbecan on 7/6/15.
 */

angular
    .module("matrixMinerApp")
    .controller("EvalCtrl", function($rootScope, $scope, $http, $window, $timeout, editorOptions, editorUtil, base64, pcmApi) {

    // Configure OpenCompare editor
    editorOptions.enableShare(false).set();
    editorOptions.enableExport(false).set();


    // Init
    var pcmMM = Kotlin.modules['pcm'].pcm;
    var factory = new pcmMM.factory.DefaultPcmFactory();
    var loader = factory.createJSONLoader();

    $scope.feature = {};
    $scope.cells = [];
    $scope.comment = "";
    $scope.selected = '';
    $scope.index = -1;
    $scope.maxIndex = 9;
    $scope.completed = 0;
    $scope.featureEval = false;
    $scope.featureOverVsSpec = false;

    // Load PCM
    $http.get("/eval/load/" + dirPath + "/" + evaluatedFeatureName)
        .success(function (data) {
            var pcmToEvaluate = data.pcmToEvaluate;
            var fullPCM = data.fullPCM;

            $scope.stringPCMToEvaluate = JSON.stringify(pcmToEvaluate.pcm);
            $scope.stringFullPCM = JSON.stringify(fullPCM.pcm);

            // Initialize other controllers
            //editorOptions.initialize({
            //    pcm: $scope.pcmToEvaluate.pcm
            //});
            $rootScope.$broadcast("overviews", pcmToEvaluate.overviews);
            $rootScope.$broadcast("specifications", pcmToEvaluate.specifications);

            // Prepare evaluation
            var pcm = loader.loadModelFromString(JSON.stringify(pcmToEvaluate.pcm)).array[0];
            pcmApi.decodePCM(pcm);
            var evaluatedFeature = pcm.features.array[0];
            $scope.feature.name = evaluatedFeature.name;

            pcm.products.array.forEach(function (product) {
                $scope.cells.push({
                    name: "prod_" + product.name,
                    product : product.name,
                    evaluated: false
                });
            });

            $scope.maxIndex = pcm.products.array.length - 1

        });

    function sendResults(status) {
        var evalResults = {
            pcm : dirPath,
            feature : $scope.feature,
            cells : $scope.cells,
            comment: $scope.comment,
            status: status
        };

        $http.post("/eval/save", evalResults)
            .success(function (data) {
                $window.location.reload();
            })
            .error(function (data) {
                console.log("an error occured while sending evaluation results")
            });
    }

    $scope.send = function() {
        sendResults("ok");
    };

    //$scope.irrelevant = function() {
    //    sendResults("irrelevant");
    //};
    //
    //$scope.bad = function() {
    //    sendResults("bad")
    //};

    $scope.allCorrect = function() {
        $scope.cells.forEach(function (cell) {
           cell.eval = "correct"
        });
    };

    $scope.allEqual = function() {
        $scope.cells.forEach(function (cell) {
            cell.overVsSpec = "specEqualOver"
        });
    };

    $scope.previous = function() {
        $scope.index--;
        editorUtil.goToCell($scope.index, 2);
    };

    $scope.next = function() {
        $scope.index++;
        editorUtil.goToCell($scope.index, 2);
    };

    $scope.getSelected = function(cell) {
        return cell.name == $scope.selected;
    };

    $scope.getIndex = function(product) {
        var found = false;
        var i = 0;
        while($scope.cells && !found) {
            if($scope.cells[i].name == product) {
                found = true;
                break;
            }
            i++;
        }
        return i;
    };

    $scope.getNextUnevaluatedProduct = function(){
        var found = false;
        var i = $scope.index+1;
        while(!found && i < $scope.cells.length) {
            if($scope.cells[i] && $scope.cells[i].evaluated == false) {
                found = true;
                break;
            }
            i++;
        }
        if(!found) {
            i = 0;
           while(!found && i <= $scope.index) {
                if($scope.cells[i] && $scope.cells[i].evaluated == false) {
                    found = true;
                    break;
                }
               i++;
            }
        }
        if(found) {
            return i;
        }
        else {
            return -1;
        }
    };

    $scope.setEvaluated = function(type){
        switch(type) {
            case 'featureEval':
                $scope.featureEval = true;
                break;
            case 'featureOverVsSpec':
                $scope.featureOverVsSpec = true;
                break;
            case 'eval':
                $scope.cells[$scope.getIndex($scope.selected)].checkEval = true;
                break;
            case 'overVsSpec':
                $scope.cells[$scope.getIndex($scope.selected)].checkOverVsSpec = true;
                break;
        }

    };

    $scope.checkValidation = function() {
        var validIrrelevant = ($scope.feature.eval === 'irrelevant') && $scope.featureOverVsSpec;
        var validComplete = $scope.featureEval && $scope.featureOverVsSpec;
        for(var i = 0; validComplete && i < $scope.cells.length; i++) {
            validComplete = $scope.cells[i].checkEval && $scope.cells[i].checkOverVsSpec;
        }
        return validComplete || validIrrelevant;
    };

    $scope.$on('selection', function(event, product, feature, cell) {
        $scope.selected = "prod_"+product;
        $scope.index =  $scope.getIndex($scope.selected);
        if($scope.index == 0) {
            editorUtil.goToCell(0, 2); // First focus on the grid is automatically set on the first row, only way found.
        }
    });

    $scope.$watch('matrixForm.$valid', function(newVal, oldVal) {
        if($scope.selected) {
            $scope.cells[$scope.getIndex($scope.selected)].evaluated = true;
        }
    });
});
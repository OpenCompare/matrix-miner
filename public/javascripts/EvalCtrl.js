/**
 * Created by gbecan on 7/6/15.
 */

matrixMinerApp.controller("EvalCtrl", function($rootScope, $scope, $http, $window, $timeout, embedService, base64, pcmApi) {

    // Configure OpenCompare editor
    embedService.enableEdit(false).set();
    embedService.enableShare(false).set();
    embedService.enableExport(false).set();


    // Init
    var pcmMM = Kotlin.modules['pcm'].pcm;
    var factory = new pcmMM.factory.DefaultPcmFactory();
    var loader = factory.createJSONLoader();

    $scope.feature = {};
    $scope.cells = [];
    $scope.selected = '';
    $scope.index = -1;
    $scope.maxIndex = 9;
    $scope.completed = 0;
    $scope.featureEval = false;

    // Load PCM
    $http.get("/eval/load/" + dirPath + "/" + evaluatedFeatureName)
        .success(function (data) {
            // Initialize other controllers
            embedService.initialize({
                pcm: data.pcm
            }); // TODO : display only the necessary feature
            $rootScope.$broadcast("overviews", data.overviews);
            $rootScope.$broadcast("specifications", data.specifications);

            // Prepare evaluation
            var pcm = loader.loadModelFromString(JSON.stringify(data.pcm)).array[0];
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

    $scope.send = function() {

        var evalResults = {
            pcm : dirPath,
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
    };

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
        embedService.goToCell($scope.index, 2);
    };

    $scope.next = function() {
        $scope.index++;
        embedService.goToCell($scope.index, 2);
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

    $scope.setEvaluated = function(type){console.log(type);
        switch(type) {
            case 'featureEval':
                $scope.featureEval = true;
                break;
            case 'eval':
                $scope.cells[$scope.getIndex($scope.selected)].eval = true;
                break;
            case 'overVsSpec':
                $scope.cells[$scope.getIndex($scope.selected)].overVsSpec = true;
                break;
        }

    };

    $scope.checkValidation = function() {
        var valid = $scope.featureEval;
        for(var i = 0; valid && i < $scope.cells.length; i++) {
            valid = $scope.cells[i].eval && $scope.cells[i].overVsSpec;
        }
        return valid;
    };

    $scope.$on('selection', function(event, product, feature, cell) {
        $scope.selected = "prod_"+product;
        $scope.index =  $scope.getIndex($scope.selected);
        if($scope.index == 0) {
            embedService.goToCell(0, 2); // First focus on the grid is automatically set on the first row, only way found.
        }
    });

    $scope.$watch('matrixForm.$valid', function(newVal, oldVal) { console.log(newVal);
        if($scope.selected) {
            $scope.cells[$scope.getIndex($scope.selected)].evaluated = true; console.log($scope.cells[$scope.getIndex($scope.selected)]);
        }
    });
});
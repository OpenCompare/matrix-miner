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
    $scope.index = 0;
    $scope.completed = 0;
    var slider = document.getElementById('slider');

    noUiSlider.create(slider, {
        start: 1, // Handle start position
        step: 1, // Slider moves in increments of '10'
        connect: 'lower',
        range: { // Slider can select '0' to '100'
            'min': 1,
            'max': 5
        }
    });

    var tipHandles = slider.getElementsByClassName('noUi-handle'),
        tooltips = [];console.log(tooltips);

    // Add divs to the slider handles.
    for ( var i = 0; i < tipHandles.length; i++ ){
        tooltips[i] = document.createElement('div');
        tipHandles[i].appendChild(tooltips[i]);
    }
    console.log(tooltips);
    // Add a class for styling
    tooltips[0].className += 'tooltip';
// Add additional markup
    tooltips[0].innerHTML = '<span></span>';
// Replace the tooltip reference with the span we just added
    tooltips[0] = tooltips[0].getElementsByTagName('span')[0];

// When the slider changes, write the value to the tooltips.
    slider.noUiSlider.on('update', function( values, handle ){
        tooltips[handle].innerHTML =  parseInt(values[handle]);
    });


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
                product : product.name
            });
        });
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
        embedService.goToCell($scope.index-1, 2);
    };

    $scope.next = function() {
        embedService.goToCell($scope.index, 2);
        $scope.index++;
    };

    $scope.getSelected = function(cell) {
        return cell.name == $scope.selected;
    };

    $scope.$on('selection', function(event, product, feature, cell) {
        $scope.selected = "prod_"+product;
    });

    $scope.$watch('matrixForm.$valid', function(newVal, oldVal) {
        console.log(newVal);
    });
});
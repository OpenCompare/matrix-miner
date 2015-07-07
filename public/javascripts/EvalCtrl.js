/**
 * Created by gbecan on 7/6/15.
 */

matrixMinerApp.controller("EvalCtrl", function($rootScope, $scope, $http, $window, embedService, base64, pcmApi) {

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

    // Load PCM
    $http.get("/eval/load/" + dirPath + "/" + evaluatedFeatureName).success(function (data) {
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
                name: "prod_" + base64.encode(product.name),
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
    }

});
/**
 * Created by hvallee on 6/23/15.
 */
var pcmApp = angular.module("openCompare", ['ui.grid', 'ui.grid.edit', 'ui.grid.selection', 'ui.grid.cellNav', 'ui.grid.resizeColumns', 'ui.grid.moveColumns', 'ui.grid.autoResize', 'ui.bootstrap', 'ui.slider',
    'pascalprecht.translate',
    'ab-base64']);
/**
 * Created by gbecan on 17/12/14.
 */


pcmApp.controller("EditorCtrl", function($controller, $rootScope, $scope, $http, $timeout, uiGridConstants, $compile, $modal, expandeditor,  $location, pcmApi) {
    if($.material) {
        $.material.init();
    }

    var subControllers = {
        $scope: $scope,
        $location: $location
    };
    $controller('InitializerCtrl', subControllers);
    $controller('UndoRedoCtrl', subControllers);
    $controller('CommandsCtrl', subControllers);
    $controller('FiltersCtrl', subControllers);
    $controller('TypesCtrl', subControllers);
    $controller('ShareCtrl', subControllers);

    // Load PCM
    var pcmMM = Kotlin.modules['pcm'].pcm;
    var factory = new pcmMM.factory.DefaultPcmFactory();
    var loader = factory.createJSONLoader();
    var serializer = factory.createJSONSerializer();

    //Export
    $scope.export_content = null;

    $scope.setEdit = function(bool, reload) {

        $scope.gridOptions.columnDefs = [];
        $scope.edit = bool;
        if(reload) {
            $timeout(function(){ $scope.initializeEditor($scope.pcm, $scope.metadata)}, 100);
        }
        $rootScope.$broadcast('setToolbarEdit', bool);
    };

    if (typeof id === 'undefined' && typeof data === 'undefined') {
        /* Create an empty PCM */
        $scope.pcm = factory.createPCM();
        $scope.setEdit(false, false);
        $scope.initializeEditor($scope.pcm, $scope.metadata);

    } else if (typeof data != 'undefined')  {
        /* Load PCM from import */
        $scope.pcm = loader.loadModelFromString(data).get(0);
        pcmApi.decodePCM($scope.pcm); // Decode PCM from Base64
        $scope.metadata = data.metadata;
        $scope.initializeEditor($scope.pcm, $scope.metadata);
    } else {
        /* Load a PCM from database */
        $scope.loading = true;
        $scope.setEdit(false, false);
        $scope.updateShareLinks();
        $http.get("/api/get/" + id).
            success(function (data) {
                $scope.pcm = loader.loadModelFromString(JSON.stringify(data.pcm)).get(0);
                pcmApi.decodePCM($scope.pcm); // Decode PCM from Base64
                $scope.metadata = data.metadata;
                $scope.initializeEditor($scope.pcm, $scope.metadata);
                $rootScope.$broadcast('saved');
            })
            .finally(function () {
                $scope.loading = false;
            })
    }
    if (typeof modal != 'undefined') {
        $scope.setEdit(false, false);
        // Open the given modal
        $modal.open({
            templateUrl: modalTemplatePath + "modal" + modal + ".html",
            controller: modal + "Controller",
            scope: $scope
        })
    }
    $scope.$on('initializeFromExternalSource', function(event, args) {
        $scope.pcm = loader.loadModelFromString(JSON.stringify(args.pcm)).get(0);
        pcmApi.decodePCM($scope.pcm); // Decode PCM from Base64
        $scope.metadata = args.metadata;
        $scope.initializeEditor($scope.pcm, $scope.metadata);
    });

    $scope.setGridHeight = function() {

        if($scope.pcmData) {
            if($scope.pcmData.length * 28 + 100 > $(window).height()* 2 / 3 && !GetUrlValue('enableEdit')) {
                $scope.height = $(window).height() * 2 / 3;
            }
            else if($scope.pcmData.length * 28 + 100 > $(window).height() && GetUrlValue('enableEdit')) {
                var height = 20;

                if(GetUrlValue('enableExport') == 'true' || GetUrlValue('enableShare') == 'true') {
                        height += 40;

                }
                if(GetUrlValue('enableTitle') == 'true') {
                    if($scope.pcm.name.length > 30) {
                        height += 120;
                    }
                    else {
                        height += 60;
                    }

                }
                if(GetUrlValue('enableEdit') == 'true') {
                    if($scope.edit) {
                        height += 80;
                    }
                    else {
                        height += 40;
                    }
                }
                $scope.height = $(window).height()-height;
            }
            else{
                $scope.height = $scope.pcmData.length * 28 + 100;
            }
        }
    };

    function convertGridToPCM(pcmData) {
        var pcm = factory.createPCM();
        pcm.name = $scope.pcm.name;

        var featuresMap = {};
        var index = 0;
        pcmData.forEach(function(productData) {
            // Create product
            var product = factory.createProduct();
            product.name = productData.name;
            pcm.addProducts(product);
            $scope.gridOptions.columnDefs.forEach(function (featureData) {

                var decodedFeatureName = convertStringToPCMFormat(featureData.name);
                var codedFeatureName = featureData.name;

                if(productData.hasOwnProperty(codedFeatureName)  && codedFeatureName !== "$$hashKey"
                    && codedFeatureName !== "Product") {
                    // Create feature if not existing
                    if (!featuresMap.hasOwnProperty(decodedFeatureName)) {
                        var feature = factory.createFeature();
                        feature.name = decodedFeatureName;
                        pcm.addFeatures(feature);
                        featuresMap[decodedFeatureName] = feature;
                    }
                    var feature = featuresMap[decodedFeatureName];

                    // Create cell
                    var cell = factory.createCell();
                    cell.feature = feature;
                    cell.content = productData[codedFeatureName];
                    cell.rawContent = $scope.pcmDataRaw[index][codedFeatureName];
                    product.addCells(cell);
                }
            });
            index++;
        });

        // Encode PCM in Base64
        pcmApi.encodePCM(pcm);

        return pcm;
    }

    $scope.scrollToFocus = function( rowIndex, colIndex ) {

        $scope.gridApi.cellNav.scrollToFocus( $scope.pcmData[rowIndex], $scope.gridOptions.columnDefs[colIndex]);
    };

    /**
     * Save PCM on the server
     */
    $scope.save = function() {

        var pcmToSave = convertGridToPCM($scope.pcmData);
        $scope.metadata = generateMetadata($scope.pcmData, $scope.gridOptions.columnDefs);
        var jsonModel = JSON.parse(serializer.serialize(pcmToSave));

        var pcmObject = {};
        pcmObject.metadata = $scope.metadata;
        pcmObject.pcm = jsonModel;
        if (typeof id === 'undefined') {
            $http.post("/api/create", pcmObject).success(function(data) {
                id = data;
                $scope.updateShareLinks();
                console.log("model created with id=" + id);
                $rootScope.$broadcast('saved');
            });
        } else {
            $http.post("/api/save/" + id, pcmObject).success(function(data) {
                console.log("model saved");
                $rootScope.$broadcast('saved');
            });
        }
    };

    /**
     * Remove PCM from server
     */
    $scope.remove = function() {

        if (typeof id !== 'undefined') {
            $http.get("/api/remove/" + id).success(function(data) {
                window.location.href = "/";
                console.log("model removed");
            });
        }
    };

    /**
     * Cancel edition
     */
    $scope.cancel = function() {

        window.location = "/view/" + id;
    };

    function generateMetadata(product, columns) {
        var metadata = {};
        metadata.featurePositions = [];
        metadata.productPositions = [];
        var index = 0;
        product.forEach(function (product) {
            var object = {};
            object.product = product.name;
            object.position = index;
            metadata.productPositions.push(object);
            index++;
        });
        index = 0;
        columns.forEach(function (column) {
            var object = {};
            object.feature = convertStringToPCMFormat(column.name);
            object.position = index;
            metadata.featurePositions.push(object);
            index++;
        });
        return metadata;
    }

    $scope.$watch('pcm.name', function() {

        if($scope.edit) {
            $rootScope.$broadcast('setPcmName', $scope.pcm.name);
        }
    });

    // Bind events from toolbar to functions of the editor

    $scope.$on('save', function(event, args) {
        $scope.save();
    });

    $scope.$on('remove', function(event, args) {
        $scope.remove();
    });

    $scope.$on('cancel', function(event, args) {
        $scope.cancel();
    });

    $scope.$on('validate', function(event, args) {
        $scope.validate();
    });

    $scope.$on('import', function(event, args) {
        $scope.pcm = loader.loadModelFromString(JSON.stringify(args.pcm)).get(0);
        pcmApi.decodePCM($scope.pcm);
        $scope.metadata = args.metadata;
        $scope.initializeEditor($scope.pcm, $scope.metadata);
    });

    $scope.$on('setGridEdit', function(event, args) {
        $scope.setEdit(args[0], args[1]);
    });

    $scope.$on('export', function (event, args) {
        var pcmToExport = convertGridToPCM($scope.pcmData);
        $scope.metadata = generateMetadata($scope.pcmData, $scope.gridOptions.columnDefs);
        var jsonModel = JSON.parse(serializer.serialize(pcmToExport));
        $scope.pcmObject = {};
        $scope.pcmObject.metadata = $scope.metadata;
        $scope.pcmObject.pcm = jsonModel;

        var ctrlArg = args.toUpperCase().charAt(0) + args.substring(1);
        $modal.open({
            templateUrl: modalTemplatePath + "modal" + ctrlArg + "Export.html",
            controller: ctrlArg + "ExportController",
            scope: $scope,
            size: "lg"
        })

    });

});
/**
 * Created by hvallee on 6/19/15.
 */

pcmApp.controller("CommandsCtrl", function($rootScope, $scope, $http, $timeout, uiGridConstants, $compile, $modal) {


    /**
     * Create a new command in the undo/redo ctrl
     */
    $scope.newCommand = function(type, parameters){

        var command = [];
        command.push(type);
        command.push(parameters);
        $scope.commands[$scope.commandsIndex] = command;
        $scope.commandsIndex++;
        $scope.canUndo = true;
    };

    /**
     * Add a new feature
     */
    $scope.addFeature = function() {

        /* Initialize data */
        var featureName = checkIfNameExists($scope.featureName, $scope.gridOptions.columnDefs);
        var codedFeatureName = convertStringToEditorFormat(featureName);

        $scope.pcmData.forEach(function (productData) {
            productData[codedFeatureName] = "";
        });
        $scope.pcmDataRaw.forEach(function (productData) {
            productData[codedFeatureName] = "";
        });

        /* Define the new column*/
        var columnDef = $scope.newColumnDef(featureName, $scope.featureType);
        $scope.gridOptions.columnDefs.push(columnDef);
        $scope.columnsType[codedFeatureName] = $scope.featureType;
        $scope.validation[codedFeatureName] = [];

        /* Command for undo/redo */
        var parameters =  [featureName, $scope.featureType, $scope.gridOptions.columnDefs.length-1];
        $scope.newCommand('addFeature', parameters);

        /* Modified for save */
        $rootScope.$broadcast('modified');
    };

    /**
     * Rename a feature
     */
    $scope.renameFeature = function() {

        var codedOldFeatureName =  convertStringToEditorFormat($scope.oldFeatureName);
        var featureName = checkIfNameExists($scope.featureName, $scope.gridOptions.columnDefs);
        var codedFeatureName = convertStringToEditorFormat(featureName);

        /* Find the feature in column defs */
        var index = 0;
        $scope.gridOptions.columnDefs.forEach(function(featureData) {
            if(featureData.name === codedOldFeatureName) {
                if(codedOldFeatureName === $scope.featureName){
                    featureName = $scope.oldFeatureName;
                }
                var index2 = 0;
                /* Create a new feature with the new name and delete the old */
                $scope.pcmData.forEach(function (productData) {
                    productData[codedFeatureName] = productData[codedOldFeatureName];
                    $scope.pcmDataRaw[index2][codedFeatureName] = $scope.pcmDataRaw[index2][codedOldFeatureName];
                    if($scope.featureName != $scope.oldFeatureName) {
                        delete productData[codedOldFeatureName];
                        delete $scope.pcmDataRaw[index2][codedOldFeatureName]
                    }
                    index2++;
                });
                /* Add the new column to column defs */
                var colDef = $scope.newColumnDef(featureName, $scope.columnsType[codedOldFeatureName]);
                $scope.gridOptions.columnDefs.splice(index, 1, colDef);

                /* Command for undo/redo */
                var parameters = [$scope.oldFeatureName, featureName, index];
                $scope.newCommand('renameFeature', parameters);
            }
            index++;
        });
        $scope.columnsType[featureName] = $scope.columnsType[codedOldFeatureName];
        $scope.validation[featureName] = [];
        if($scope.featureName != $scope.oldFeatureName) {
            delete $scope.columnsType[codedOldFeatureName];
            delete $scope.validation[codedOldFeatureName];
        }
        /* re-init of scope parameters */
        $scope.featureName = "";
        $scope.oldFeatureName = "";

        /* Modified for save */
        $rootScope.$broadcast('modified');
    };

    /**
     * Delete a feature
     * @param featureName
     */
    $scope.deleteFeature = function(featureName) {

        delete $scope.validation[featureName];
        var index = 0;
        $scope.gridOptions.columnDefs.forEach(function(featureData) {
            if(featureData.name === featureName) {
                var parameters = [];
                var values = [];
                var rawValues = [];
                var index2 = 0;
                $scope.pcmData.forEach(function (productData) {
                    var value = [productData.$$hashKey, productData[featureName]];
                    var rawValue = [productData.$$hashKey, $scope.pcmDataRaw[index2][featureName]];
                    values.push(value);
                    rawValues.push(rawValue);
                    delete $scope.pcmData[index2][featureData.name];
                    delete $scope.pcmDataRaw[index2][featureData.name];
                    index2++;
                });
                parameters.push($scope.gridOptions.columnDefs[index]);
                parameters.push(values);
                parameters.push(rawValues);
                parameters.push(index);
                $scope.newCommand('removeFeature', parameters);
                $scope.gridOptions.columnDefs.splice(index, 1);
            }
            index++;
        });
        console.log("Feature is deleted");
        $rootScope.$broadcast('modified');
    };

    /**
     * Change the type of a column
     */
    $scope.changeType = function () {

        var featureName = $scope.featureName;
        var codedFeatureName = convertStringToEditorFormat(featureName);
        var found = false;
        for(var i = 0; i < $scope.gridOptions.columnDefs.length && !found; i++) {
            if($scope.gridOptions.columnDefs[i].name == codedFeatureName) {
                var oldType = $scope.columnsType[codedFeatureName];
                found = true;
                $scope.gridOptions.columnDefs.splice(i, 1);
                var colDef = $scope.newColumnDef(featureName, $scope.featureType);
                $timeout(function(){ $scope.gridOptions.columnDefs.splice(i-1, 0, colDef); }, 100);// Not working without a timeout
                var parameters = [featureName, oldType, $scope.featureType];
                $scope.newCommand('changeType', parameters);
                $scope.columnsType[codedFeatureName] = $scope.featureType;
            }
        }
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
    };

    /**
     * Add a new product and focus on this new
     * @param row
     */
    $scope.addProduct = function() {

        var productData = {};
        var rawProduct = [];
        productData.name = "";

        $scope.gridOptions.columnDefs.forEach(function(featureData) {
            if(featureData.name != " " && featureData.name != "Product") { // There must be a better way but working for now
                productData[featureData.name] = "";
                rawProduct[featureData.name] = "";
            }
        });
        $scope.pcmDataRaw.push(rawProduct);
        $scope.pcmData.push(productData);

        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
        $timeout(function(){ $scope.scrollToFocus($scope.pcmData.length-1, 1); }, 100);// Not working without a timeout
        console.log("Product added");
        $rootScope.$broadcast('modified');
        var parameters = $scope.pcmData[$scope.pcmData.length-1];
        $scope.newCommand('addProduct', parameters);
        $scope.setGridHeight();
    };

    /**
     * Remove a product
     * @param row
     */
    $scope.removeProduct = function(row) {

        var index = $scope.pcmData.indexOf(row.entity);
        var rawData = $scope.pcmDataRaw[index];
        $scope.pcmData.splice(index, 1);
        $scope.pcmDataRaw.splice(index, 1);
        $rootScope.$broadcast('modified');
        var parameters = [row.entity.$$hashKey, row.entity, rawData, index];
        $scope.newCommand('removeProduct', parameters);
        $scope.setGridHeight();
    };

});/**
 * Created by hvallee on 6/19/15.
 */

pcmApp.controller("FiltersCtrl", function($rootScope, $scope, $http, $timeout, uiGridConstants, $compile, $modal) {

    //Custom filters
    var $elm;
    $scope.columnsFilters = [];
    $scope.productFilter = "";

    /* Initialize for filter */
    $scope.gridOptions2 = {
        enableColumnMenus: false,
        onRegisterApi: function( gridApi) {
            $scope.gridApi2 = gridApi;
        }
    };

    // Slider filter
    $scope.slider = {
        options: {
            range: true
        }
    };
    $scope.filterSlider = [];

    $scope.removeFilter = function(col) {

        var featureName = col.name;
        var type =  $scope.columnsType[featureName];
        switch(type) {
            case 'string':
                delete  $scope.columnsFilters[featureName];
                break;
            case 'number':
                $scope.gridOptions.columnDefs.forEach(function (feature) {
                    if(feature.name == featureName) {
                        delete feature.filters[0].term;
                        delete feature.filters[1].term;
                    }
                });
                delete  $scope.columnsFilters[featureName];
                break;
        }
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
    };

    $scope.applyBooleanFilter = function(col, value){
        if($scope.columnsFilters[col.name] == value) {
            $scope.columnsFilters[col.name] = 0;
        }
        else {
            $scope.columnsFilters[col.name] = value;
        }
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
    };

    $scope.applyProductFilter = function() {
        $scope.gridOptions.columnDefs[1].filter.term = $scope.productFilter;
    };

    $scope.isFilterOn = function(col) {

        return $scope.columnsFilters[col.name];
    };

    $scope.checkFilterSliderMin = function() {
        if($scope.filterSlider[0] > $scope.filterSlider[1]){
            $scope.filterSlider[0] = $scope.filterSlider[1];
        }
    };

    $scope.checkFilterSliderMax = function() {
        if($scope.filterSlider[1] < $scope.filterSlider[0]){
            $scope.filterSlider[1] = $scope.filterSlider[0];
        }
    };

    $scope.showFilter = function(feature) {

        $scope.featureToFilter = feature.name;
        $scope.ListToFilter = [];
        $scope.gridOptions2.data = [];
        var type = $scope.columnsType[feature.name];
        switch(type) {

            case 'string':
                $scope.gridApi2.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
                $scope.pcmData.forEach( function ( productData ) {
                    if ($scope.ListToFilter.indexOf(productData[feature.name] ) === -1 ) {
                        $scope.ListToFilter.push(productData[feature.name]);
                    }
                });
                $scope.ListToFilter.sort();
                $timeout(function() {
                    $scope.ListToFilter.forEach(function (product) {
                        $scope.gridOptions2.data.push({product: product});
                    });
                }, 100);

                $('#modalStringFilter').modal('show');
                break;

            case 'number':

                var minAndMax = findMinAndMax($scope.featureToFilter, $scope.pcmData);
                $scope.slider.options.min = minAndMax[0];
                $scope.slider.options.max = minAndMax[1];
                $scope.filterSlider[0] = minAndMax[0];
                $scope.filterSlider[1] = minAndMax[1];
                if(minAndMax[1] < 10) {
                    $scope.slider.options.step = 0.1;
                }
                else if(minAndMax[1] > 1000) {
                    $scope.slider.options.step = 10;
                }
                else {
                    $scope.slider.options.step = 1;
                }
                break;

        }
    };

    $scope.closeFilter = function() {
        var featureName = $scope.featureToFilter;
        var codedFeatureName = convertStringToEditorFormat(featureName);

        var type =  $scope.columnsType[codedFeatureName];
        switch(type) {

            case 'string':
                var selec = $scope.gridApi2.selection.getSelectedRows();
                if (selec.length == 0) {
                    $scope.gridOptions2.data.forEach(function (productData) {
                        selec.push(productData);
                    });
                }
                $scope.colFilter = [];
                $scope.colFilter.listTerm = [];

                selec.forEach(function (product) {
                    $scope.colFilter.listTerm.push(product.product);
                });
                $scope.columnsFilters[codedFeatureName] = [];
                $scope.columnsFilters[codedFeatureName] = $scope.colFilter.listTerm;
                $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
                break;

            case 'number':
                $scope.gridOptions.columnDefs.forEach(function (feature) {
                    if(feature.name == codedFeatureName) {
                        feature.filters[0].term = $scope.filterSlider[0];
                        feature.filters[1].term = $scope.filterSlider[1]+1;
                    }
                });
                $scope.columnsFilters[codedFeatureName] = [];
                break;
        }
        if ($elm) {
            $elm.remove();
        }
    };

    $scope.filterStringColumns = function(cellValue, codedFeatureName) {
        if($scope.columnsFilters[codedFeatureName]) {
            var inFilter = false;
            var index = 0;
            while(!inFilter && index < $scope.columnsFilters[codedFeatureName].length) {
                if(cellValue == $scope.columnsFilters[codedFeatureName][index] || isEmptyCell(cellValue)) {
                    inFilter = true;
                }
                index++;
            }
            return inFilter;
        }
        else {
            return true;
        }
    };

    $scope.filterLessNumberColumns = function(cellValue, columnDef, codedFeatureName) {
        if($scope.columnsFilters[codedFeatureName]) {
            return (parseFloat(cellValue.replace(/\s/g, "").replace(",", ".")) >= columnDef.filters[0].term || isEmptyCell(cellValue));
        }
        else {
            return true;
        }
    };

    $scope.filterGreaterNumberColumns = function(cellValue, columnDef, codedFeatureName) {
        if($scope.columnsFilters[codedFeatureName]) {
            return (parseFloat(cellValue.replace(/\s/g, "").replace(",", ".")) <= columnDef.filters[1].term || isEmptyCell(cellValue));
        }
        else {
            return true;
        }
    };

    $scope.filterBooleanColumns = function(cellValue, codedFeatureName) {
        if($scope.columnsFilters[codedFeatureName] == 1) {
            return getBooleanValue(cellValue) == "yes" || isEmptyCell(cellValue);
        }
        else if($scope.columnsFilters[codedFeatureName] == 2) {
            return getBooleanValue(cellValue) == "no" || isEmptyCell(cellValue);
        }
        else {
            return true;
        }
    };


    function getBooleanValue (name){

        if(name.toLowerCase() === "yes" || name.toLowerCase() === "true") {
            return "yes";
        }
        else  if(name.toLowerCase() === "no" || name.toLowerCase() === "false") {
            return "no";
        }
        else {
            return "unknown";
        }
    }

});





/**
 * Created by hvallee on 6/19/15.
 */

pcmApp.controller("InitializerCtrl", function($rootScope, $scope, $http, $timeout, uiGridConstants, $location, pcmApi, expandeditor, typeService, embedService) {

    $scope.height = 300;
    $scope.enableEdit = embedService.enableEdit().get;
    $scope.enableExport = embedService.enableExport().get;
    $scope.enableTitle = true;
    $scope.enableShare = embedService.enableShare().get;

    $scope.gridOptions = {
        columnDefs: [],
        data: 'pcmData',
        enableRowSelection: false,
        enableRowHeaderSelection: false,
        flatEntityAccess: true,
        enableColumnResizing: true,
        enableFiltering: true,
        enableCellSelection: false,
        enableCellEdit: false,
        headerRowHeight: 60,
        rowHeight: 28
    };
    $scope.columnMovedFunctions = [];
    $scope.beginCellEditFunctions = [];
    $scope.afterCellEditFunctions = [];
    $scope.onNavigateFunctions = [];

    $scope.loading = false;

    /* Grid event functions */
    $scope.setRawValue = function(rowEntity, colDef, rawValue, contentValue) {

        rawValue = $scope.pcmDataRaw[$scope.pcmData.indexOf(rowEntity)][colDef.name];
        contentValue = rowEntity[colDef.name];
        rowEntity[colDef.name] = rawValue;
    };

    $scope.setVisualRepresentation = function(rowEntity, colDef, newValue, oldValue, rawValue, contentValue) {

        if(newValue && rawValue != newValue) {
            $rootScope.$broadcast('modified');
            $scope.pcmData[$scope.pcmData.indexOf(rowEntity)][colDef.name] = getVisualRepresentation(newValue, $scope.pcmData.indexOf(rowEntity),
                colDef.name, rowEntity.$$hashKey, contentValue, rawValue, newValue);
        }
        else {
            $scope.pcmData[$scope.pcmData.indexOf(rowEntity)][colDef.name] = contentValue;
        }
        /* Update value based on visual representation and raw */
        $scope.pcmDataRaw[$scope.pcmData.indexOf(rowEntity)][colDef.name] = newValue;
    };

    $scope.moveColumnData = function(colDef, originalPosition, newPosition) {

        $scope.gridOptions.columnDefs.move(originalPosition, newPosition);
        var commandParameters = [originalPosition, newPosition];

        $scope.newCommand('move', commandParameters);
        $rootScope.$broadcast('modified');
    };
    $scope.columnMovedFunctions.push($scope.moveColumnData);
    $scope.beginCellEditFunctions.push($scope.setRawValue);
    $scope.afterCellEditFunctions.push($scope.setVisualRepresentation);

    /* Register grid functions */
    $scope.gridOptions.onRegisterApi = function(gridApi){

        var contentValue;
        var rawValue;
        //set gridApi on scope
        $scope.gridApi = gridApi;

        /* Called when columns arem oved */
        gridApi.colMovable.on.columnPositionChanged($scope,function(colDef, originalPosition, newPosition){
            for(var i = 0; i <   $scope.columnsMovedFunctions.length; i++) {
                $scope.columnMovedFunctions[i]();
            }
        });

        gridApi.edit.on.beginCellEdit($scope, function(rowEntity, colDef) {
            for(var i = 0; i <   $scope.beginCellEditFunctions.length; i++) {
                $scope.beginCellEditFunctions[i](rowEntity, colDef, contentValue, rawValue);
            }

        });

        gridApi.edit.on.afterCellEdit($scope,function(rowEntity, colDef, newValue, oldValue){
            for(var i = 0; i <   $scope.afterCellEditFunctions.length; i++) {
                $scope.afterCellEditFunctions[i](rowEntity, colDef, newValue, oldValue, rawValue, contentValue);
            }
        });

        gridApi.cellNav.on.navigate($scope,function(rowEntity, colDef){
            for(var i = 0; i <   $scope.onNavigateFunctions.length; i++) {
                $scope.onNavigateFunctions[i](rowEntity, colDef);
            }
            var expandedFunctions = expandeditor.expandNavigateFunctions().navigateFunctions;
            for(var i = 0; i <   expandedFunctions.length; i++) {
                expandedFunctions[i](rowEntity, colDef);
            }
        });
    };

    $scope.setGridHeight = function() {

        if($scope.pcmData) {
            if($scope.pcmData.length * 28 + 90 > $(window).height()* 2 / 3 && !GetUrlValue('enableEdit')) {
                $scope.height = $(window).height() * 2 / 3;
            }
            else if($scope.pcmData.length * 28 + 90 > $(window).height()) {
                $scope.height = $(window).height();
            }
            else{
                $scope.height = $scope.pcmData.length * 28 + 90;
            }
        }
    };

    /**
     *  Create a new ColumnDef for the ui-grid
     * @param featureName
     * @param featureType
     * @returns colDef
     */
    $scope.newColumnDef = function(featureName, featureType) {
        if(!featureType) {
            featureType = "string";
        }
        var codedFeatureName = convertStringToEditorFormat(featureName);
        $scope.columnsType[codedFeatureName] = featureType;
        var columnDef = {
            name: codedFeatureName,
            displayName: featureName,
            enableSorting: true,
            enableHiding: false,
            enableFiltering: true,
            enableColumnResizing: true,
            enableColumnMoving: $scope.edit,
            enableCellEdit: $scope.edit,
            enableCellEditOnFocus: $scope.edit,
            allowCellFocus: true,
            filter: {term: ''},
            minWidth: 80,
            menuItems: [
                {
                    title: 'Hide',
                    icon: 'fa fa-eye-slash',
                    action: function($event) {
                        $scope.gridOptions.columnDefs.forEach(function(featureData) {
                            if(featureData.name === codedFeatureName) {
                                columnDef.visible = false;
                                $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
                            }
                        });
                    }
                },
                {
                    title: 'Rename Feature',
                    shown: function () {
                        return $scope.edit;
                    },
                    icon: 'fa fa-pencil',
                    action: function($event) {
                        $('#modalRenameFeature').modal('show');
                        $scope.oldFeatureName = featureName;
                        $scope.featureName = featureName;
                    }
                },
                {
                    title: 'Change Type',
                    shown: function () {
                        return $scope.edit;
                    },
                    icon: 'fa fa-exchange',
                    action: function($event) {
                        $('#modalChangeType').modal('show');
                        $scope.oldFeatureName = featureName;
                        $scope.featureName = featureName;
                        $scope.featureType = $scope.columnsType[codedFeatureName];
                    }
                },
                {
                    title: 'Delete Feature',
                    shown: function () {
                        return $scope.edit;
                    },
                    icon: 'fa fa-trash-o',
                    action: function($event) {
                        $scope.deleteFeature(codedFeatureName);
                    }
                },
                {
                    title: 'Unhide everything',
                    icon: 'fa fa-eye',
                    action: function($event) {
                        $scope.gridOptions.columnDefs.forEach(function(featureData) {
                            featureData.visible = true;
                        });
                        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
                    }
                }
            ],
            cellClass: function(grid, row, col) {
                var rowValue = $scope.pcmDataRaw[$scope.pcmData.indexOf(row.entity)];
                if($scope.validating && $scope.validation[col.name] && !$scope.validation[col.name][$scope.pcmData.indexOf(row.entity)]) {
                    return 'warningCell';
                }
                else if(rowValue) {
                    return getCellClass(rowValue[col.name]);
                }
            },
            cellTooltip: function(row, col) {
                var rawValue = $scope.pcmDataRaw[$scope.pcmData.indexOf(row.entity)];
                var contentValue = $scope.pcmData[$scope.pcmData.indexOf(row.entity)];
                if($scope.validating && $scope.validation[col.name] && !$scope.validation[col.name][$scope.pcmData.indexOf(row.entity)]) {
                    return "This value doesn't seem to match the feature type.";
                }
                else if(rawValue && getCellTooltip(rawValue[col.name])){
                    return getCellTooltip(rawValue[col.name]);
                }
                else if(contentValue) {
                    return contentValue[col.name];
                }
            }
        };
        switch(featureType) {
            case "string":
                columnDef.filterHeaderTemplate="" +
                    "<div class='ui-grid-filter-container'>" +
                    "   <button class='btn btn-primary fa fa-search btn-sm' ng-click='grid.appScope.showFilter(col)'>" +
                    "   </button>" +
                    "   <button ng-show='grid.appScope.isFilterOn(col)' class='btn btn-default btn-sm fa fa-close'  ng-click='grid.appScope.removeFilter(col)'>" +
                    "   </button>" +
                    "</div>";
                columnDef.filter.noTerm = true;
                columnDef.filter.condition = function (searchTerm,  cellValue) {
                    return $scope.filterStringColumns(cellValue, codedFeatureName);
                };
                break;
            case "number":
                var filterLess = [];
                filterLess.condition  = function (searchTerm,  cellValue) {
                    return $scope.filterLessNumberColumns(cellValue, columnDef, codedFeatureName);
                };
                columnDef.filterHeaderTemplate="" +
                    "<div class='ui-grid-filter-container'>" +
                    "   <button class='btn btn-primary btn-sm fa fa-sliders' ng-click='grid.appScope.showFilter(col)' data-toggle='modal' data-target='#modalSlider'>" +
                    "   </button>" +
                    "   <button  ng-show='grid.appScope.isFilterOn(col)' class='btn btn-default btn-sm fa fa-close' ng-click='grid.appScope.removeFilter(col)'>" +
                    "   </button>" +
                    "</div>";
                var filterGreater = [];
                filterGreater.condition  = function (searchTerm,  cellValue) {
                    return $scope.filterGreaterNumberColumns(cellValue, columnDef, codedFeatureName);
                };
                columnDef.filters = [];
                columnDef.filters.push(filterGreater);
                columnDef.filters.push(filterLess);
                break;
            case "boolean":
                var filterName = 'filter'+featureName.replace(/[&-/\s]/gi, '');
                var columnFilterValue = $scope.columnsFilters[codedFeatureName];
                columnDef.filterHeaderTemplate="" +
                    "<div class='ui-grid-filter-container'>" +
                    "<button class='btn btn-primary btn-xs' ng-class='{\"btn btn-primary btn-xs \" : grid.appScope.isFilterOn(col) == 1, \"btn btn-flat btn-primary btn-xs\": grid.appScope.isFilterOn(col) != 1}' ng-click='grid.appScope.applyBooleanFilter(col, 1)' >Yes</button>" +
                    "<button class='btn btn-danger btn-flat' ng-class='{\"btn btn-danger btn-xs \" : grid.appScope.isFilterOn(col) == 2, \"btn btn-flat btn-danger btn-xs\": grid.appScope.isFilterOn(col) != 2}' btn-xs' ng-click='grid.appScope.applyBooleanFilter(col, 2)' >No</button>" +
                    "</div>";
                columnDef.filter.noTerm = true;
                columnDef.filter.condition = function (searchTerm,  cellValue) {
                    return $scope.filterBooleanColumns(cellValue, codedFeatureName);
                };
                break;

        }
        return columnDef;
    };

    /**
     * Initialize the editor
     * @param pcm
     */
    $scope.initializeEditor = function(pcm, metadata, decode) {

        if(decode) {
            pcm = pcmApi.decodePCM(pcm); // Decode PCM from Base64
        }

        /* Convert PCM model to editor format */
        var features = pcmApi.getConcreteFeatures(pcm);
        $scope.pcmData = pcm.products.array.map(function(product) {
            var productData = {};
            features.map(function(feature) {
                var featureName = convertStringToEditorFormat(feature.name);
                if(!feature.name){
                    featureName = " ";
                }
                var cell = pcmApi.findCell(product, feature);
                productData.name = product.name; // FIXME : may conflict with feature name
                productData[featureName] = cell.content;
            });
            return productData;
        });
        // Return rawcontent
        $scope.pcmDataRaw = pcm.products.array.map(function(product) {
            var productDataRaw = {};
            features.map(function(feature) {
                var featureName =  convertStringToEditorFormat(feature.name);
                if(!feature.name){
                    featureName = " ";
                }
                var cell = pcmApi.findCell(product, feature);
                productDataRaw.name = product.name; // FIXME : may conflict with feature name
                if(cell.rawContent && cell.rawContent != "") {
                    productDataRaw[featureName] = cell.rawContent;
                }
                else {
                    productDataRaw[featureName] = cell.content;// TODO: replace content with rawcontent when implemented
                }
            });
            return productDataRaw;
        });
        $rootScope.$broadcast('setPcmName', $scope.pcm.name);

        createColumns(pcm, metadata);
        setOptions();

        $scope.setGridHeight();
    };

    function createColumns(pcm, metadata) {
        /* Define columns */
        var columnDefs = [];

        /* Column for each feature */
        var colIndex = 0;
        pcm.features.array.forEach(function (feature) {
            var featureName = feature.name;
            if(!feature.name){
                featureName = " ";
            }
            var colDef = $scope.newColumnDef(featureName, typeService.getType(featureName, $scope.pcmData));
            columnDefs.push(colDef);
            colIndex++;
        });
        if(metadata) {
            $scope.pcmData = sortProducts($scope.pcmData, metadata.productPositions);
            $scope.pcmDataRaw = sortRawProducts($scope.pcmDataRaw, $scope.pcmData);
            columnDefs = sortFeatures(columnDefs, metadata.featurePositions);
        }
        $scope.gridOptions.columnDefs = columnDefs;
        var toolsColumn = {
            name: ' ',
            cellTemplate: '<div class="buttonsCell" ng-show="grid.appScope.edit">' +
            '<button role="button" class="btn btn-flat btn-default" ng-click="grid.appScope.removeProduct(row)"><i class="fa fa-times"></i></button>'+
            '</div>',
            enableCellEdit: false,
            enableFiltering: false,
            enableSorting: false,
            enableHiding: false,
            enableColumnMenu: false,
            allowCellFocus: false,
            enableColumnMoving: false
        };
        switch($scope.edit) {
            case true:
                toolsColumn.width = 30;
                break;
            case false:
                toolsColumn.width = 1;
                break;
        }

        /* Second column for the products */
        var productsColumn = {
            name: 'Product',
            field: "name",
            cellClass: function(grid, row, col, rowRenderIndex, colRenderIndex) {
                return 'productCell';
            },
            enableSorting: true,
            enableHiding: false,
            enableColumnMoving: false,
            enableCellEdit: $scope.edit,
            enableCellEditOnFocus: $scope.edit,
            allowCellFocus: true,
            minWidth: 100,
            menuItems: [
                {
                    title: 'Unhide everything',
                    icon: 'fa fa-eye',
                    action: function($event) {
                        $scope.gridOptions.columnDefs.forEach(function(featureData) {
                            featureData.visible = true;
                        });
                        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
                    }
                }
            ]
        };

        /* Specific filter for products */
        productsColumn.filter = [];
        productsColumn.filter.term = '';
        productsColumn.filter.placeholder = 'Find';
        productsColumn.filterHeaderTemplate="" +
            "<div class='ui-grid-filter-container'>" +
            "   <input type='text' class='form-control floating-label' ng-change='grid.appScope.applyProductFilter()' ng-model='grid.appScope.productFilter' placeholder='Find'"+
            "</div>";
        $scope.gridOptions.columnDefs.splice(0, 0, toolsColumn);
        $scope.gridOptions.columnDefs.splice(1, 0, productsColumn);
    }

    function setOptions() {
        if(GetUrlValue('enableEdit') == 'false'){
            $scope.enableEdit = false;
        }
        if(GetUrlValue('enableExport') == 'false'){
            $scope.enableExport = false;
        }
        if(GetUrlValue('enableTitle') == 'false'){
            $scope.enableTitle = false;
        }
        if(GetUrlValue('enableShare') == 'false'){
            $scope.enableShare = false;
        }
    }



    /**
     * Get the visual representation of a raw data
     * @param cellValue
     * @returns {Array.<T>|string|Blob|ArrayBuffer|*}
     */
    function getVisualRepresentation(cellValue, index, colName, hashkey, oldValue, oldRawValue, newRawValue) {
        $http.post("/api/extract-content", {
            type: 'wikipedia',
            rawContent: cellValue,
            responseType: "text/plain",
            transformResponse: function(d, e) { // Needed to not interpret matrix as json (begin with '{|')
                return d;
            }
        }).success(function(data) {
            var commandParameters = [];
            $scope.pcmData[index][colName] = data;

            if (colName != "Product") {
                commandParameters = [hashkey, colName, oldValue, data, oldRawValue, newRawValue];
            }
            else {
                commandParameters = [hashkey, 'name', oldValue, data, oldRawValue, newRawValue];
            }
            $scope.newCommand('edit', commandParameters);
            $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
        });

        return 'Loading value...';
    }


});

/**
 * Created by hvallee on 6/19/15.
 */
pcmApp.controller("TypesCtrl", function($rootScope, $scope, $http, $timeout, uiGridConstants, $compile, $modal, typeService) {

    // Validate pcm type
    $scope.columnsType = [];
    $scope.featureType = 'string';
    $scope.validation = [];
    $scope.validating = false;


    /**
     * Validate data based of type columns
     */
    $scope.validate = function() {
        /* change validation mode */
        $scope.validating = !$scope.validating;
        /* Init validation array */
        if($scope.pcmData.length > 0){
            var initValid = [];
            var index = 0;
            $scope.gridOptions.columnDefs.forEach(function (featureData){
                if(featureData.name != " " && featureData.name != "Product"){
                    $scope.validation[featureData.name] = [];
                    initValid[index] = featureData.name;
                    index++;
                }
            });
            /* Fill in validation array */
            index = 0;
            $scope.pcmData.forEach(function (productData){
                for(var i = 0; i < initValid.length; i++) {
                    var featureName = initValid[i];
                    if(featureName != " ") {
                        $scope.validation[featureName][index] =  typeService.validateType(productData[featureName], $scope.columnsType[featureName]);
                    }
                }
                index++;
            });
        }
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
        $rootScope.$broadcast("validating");
    };



});



/**
 * Created by hvallee on 6/19/15.
 */

pcmApp.controller("UndoRedoCtrl", function($rootScope, $scope, $http, $timeout, uiGridConstants, $compile, $modal) {

    //Undo-redo
    $scope.commands = [];
    $scope.commandsIndex = 0;
    $scope.canUndo = false;
    $scope.canRedo = false;

    $scope.undo = function() {

        if($scope.commandsIndex > 0) {
            $scope.commandsIndex--;
            $scope.canRedo = true;
            var command = $scope.commands[$scope.commandsIndex];
            var parameters = command[1];

            switch(command[0]) {
                case 'move':
                    $scope.gridOptions.columnDefs.move(parameters[1], parameters[0]);
                    break;
                case 'edit':
                    undoEdit(parameters[0], [parameters[1]],  parameters[2]);
                    break;
                case 'removeProduct':
                    undoRemoveProduct(parameters[1], parameters[2], parameters[3]);
                    break;
                case 'addProduct':
                    undoAddProduct(parameters.$$hashKey);
                    break;
                case 'removeFeature':
                    undoRemoveFeature(parameters[0], parameters[1], parameters[2], parameters[3]);
                    break;
                case 'renameFeature':
                    undoRenameFeature(parameters[0], parameters[1], parameters[2]);
                    break;
                case 'changeType':
                    undoChangeType(parameters[0], parameters[1]);
                    break;
                case 'addFeature':
                    undoAddFeature(parameters[0], parameters[2]);
                    break;
            }
            if($scope.commandsIndex <= 0){
                $scope.canUndo = false;
            }
        }
    };

    $scope.redo = function() {

        if($scope.commandsIndex < $scope.commands.length) {
            var command = $scope.commands[$scope.commandsIndex];
            var parameters = command[1];
            switch(command[0]) {
                case 'move':
                    $scope.gridOptions.columnDefs.move(parameters[0], parameters[1]);
                    break;
                case 'edit':
                    redoEdit(parameters[0], parameters[1], parameters[3], parameters[5]);
                    break;
                case 'removeProduct':
                    undoAddProduct(parameters[0]);
                    break;
                case 'addProduct':
                    redoAddProduct(parameters);
                    break;
                case 'removeFeature':
                    undoAddFeature(parameters[0].name, parameters[3]);
                    break;
                case 'renameFeature':
                    undoRenameFeature(parameters[1], parameters[0], parameters[2]);
                    break;
                case 'changeType':
                    undoChangeType(parameters[0], parameters[2]);
                    break;
                case 'addFeature':
                    redoAddFeature(parameters[0], parameters[1]);
            }
            $scope.commandsIndex++;
            $scope.canUndo = true;
            if($scope.commandsIndex >= $scope.commands.length){
                $scope.canRedo = false;
            }
        }
    };

    function undoEdit(productHashKey, featureName, oldValue,  oldRawValue) {
        var found = false;
        for(var i = 0; i < $scope.pcmData.length && !found; i++) {
            if ($scope.pcmData[i].$$hashKey == productHashKey) {
                $scope.pcmData[i][featureName] = oldValue;
                $scope.pcmDataRaw[i][featureName] = oldRawValue;
                found = true;
            }
        }
    }

    function redoEdit(productHashKey, featureName, newValue,  newRawValue) {
        var found = false;
        for(var i = 0; i < $scope.pcmData.length && !found; i++) {
            if ($scope.pcmData[i].$$hashKey == productHashKey) {
                $scope.pcmData[i][featureName] = newValue;
                $scope.pcmDataRaw[i][featureName] = newRawValue;
                found = true;
            }
        }
    }

    function undoRemoveProduct(product, rawProduct, index) {
        $scope.pcmData.splice(index, 0, product);
        $scope.pcmDataRaw.splice(index, 0, rawProduct);
        $timeout(function(){ $scope.scrollToFocus(index, 1); }, 100);// Not working without a timeout
        $scope.setGridHeight();
    }

    function undoAddProduct(productHashKey) {
        var found = false;
        for(var i = 0; i < $scope.pcmData.length && !found; i++) {
            if ($scope.pcmData[i].$$hashKey == productHashKey) {
                $scope.pcmData.splice($scope.pcmData.indexOf($scope.pcmData[i]), 1);
                $scope.pcmDataRaw.splice($scope.pcmData.indexOf($scope.pcmData[i]), 1);
                found = true;
            }
        }
        $scope.setGridHeight();
    }

    function redoAddProduct(parameters) {
        $scope.pcmData.push(parameters);
        $scope.pcmDataRaw.push(parameters);
        $timeout(function(){ $scope.scrollToFocus($scope.pcmData.length-1, 1); }, 100);// Not working without a timeout
        $scope.setGridHeight();
    }

    function undoRemoveFeature(feature, products, rawProducts, featureIndex) {
        $scope.gridOptions.columnDefs.splice(featureIndex, 0, feature);
        $scope.pcmData.forEach(function(product){
            var i = 0;
            var found = false;
            while(i < products.length && !found) {
                if(product.$$hashKey == products[i][0]) {
                    product[feature.name] = products[i][1];
                    $scope.pcmDataRaw[i][feature.name] = rawProducts[i][1];
                    found = true;
                }
                i++;
            }
        });
    }

    function redoAddFeature(featureName, featureType) {
        var columnDef = $scope.newColumnDef(featureName, featureType);
        $scope.gridOptions.columnDefs.push(columnDef);
        /* Initialize data */
        var featureName = checkIfNameExists(featureName, $scope.gridOptions.columnDefs);
        $scope.pcmData.forEach(function (productData) {
            productData[featureName] = "";
        });
        $scope.pcmDataRaw.forEach(function (productData) {
            productData[featureName] = "";
        });
        $scope.columnsType[featureName] = featureType;
        $scope.validation[featureName] = [];
        $rootScope.$broadcast('modified');
    }

    function undoRenameFeature(oldFeatureName, featureName, index) {

        var codedFeatureName = convertStringToEditorFormat(featureName);
        var codedOldFeatureName = convertStringToEditorFormat(oldFeatureName);
        var found = false;
        for(var i = 0; !found && i < $scope.gridOptions.columnDefs.length; i++) {
            if($scope.gridOptions.columnDefs[i].name === codedFeatureName) {
                found = true;
                var index2 = 0;
                $scope.pcmData.forEach(function (productData) {
                    productData[codedOldFeatureName] = productData[codedFeatureName];
                    $scope.pcmDataRaw[index2][codedOldFeatureName] = $scope.pcmDataRaw[index2][codedFeatureName];
                    if(featureName != codedOldFeatureName) {
                        delete productData[codedFeatureName];
                        delete $scope.pcmDataRaw[index2][codedFeatureName];
                    }
                    index2++;
                });
                var colDef = $scope.newColumnDef(oldFeatureName, $scope.columnsType[codedFeatureName]);
                $scope.gridOptions.columnDefs.splice(index, 1, colDef);
            }
        }
        $scope.columnsType[codedOldFeatureName] = $scope.columnsType[codedFeatureName];
        $scope.validation[codedFeatureName] = [];
        if(codedOldFeatureName != codedOldFeatureName) {
            delete $scope.columnsType[codedFeatureName];
            delete $scope.validation[codedFeatureName];
        }
    }

    function undoChangeType(featureName, oldType) {
        var found = false;
        for(var i = 0; i < $scope.gridOptions.columnDefs.length && !found; i++) {
            if($scope.gridOptions.columnDefs[i].name == featureName) {
                found = true;
                $scope.gridOptions.columnDefs.splice(i, 1);
                var colDef = $scope.newColumnDef(featureName, oldType);
                $timeout(function(){ $scope.gridOptions.columnDefs.splice(i-1, 0, colDef); }, 100);// Not working without a timeout
            }
        }
        $scope.gridApi.core.notifyDataChange(uiGridConstants.dataChange.COLUMN);
    }

    function undoAddFeature(featureName, index) {
        $scope.pcmDataRaw.forEach(function (productData) {
            delete productData[featureName];
        });
        $scope.pcmData.forEach(function (productData) {
            delete productData[featureName];
        });
        $scope.gridOptions.columnDefs.splice(index, 1);
    }





});
/**
 * Created by hvallee on 6/19/15.
 */

pcmApp.controller("ShareCtrl", function($rootScope, $scope, $http, $timeout, uiGridConstants, $compile, $modal) {

    $scope.activeShareButton = false;

    $scope.enableEditOption = false;
    $scope.enableExportOption = false;
    $scope.enableTitleOption = false;
    $scope.enableShareOption = false;


    $scope.updateShareLinks = function() {
        $scope.activeShareButton = true;
        $scope.embedLink = '<iframe src="http://'+window.location.hostname+':'+window.location.port+'/embedPCM/'+id
            +'?enableEdit='+$scope.enableEditOption+'&enableExport='+$scope.enableExportOption+'&enableTitle='+$scope.enableTitleOption+'&enableShare='+$scope.enableShareOption
            +'" scrolling="no"  width="100%" height="700px" style="border:none;"></iframe>';
        $scope.twitterLink = 'https://twitter.com/intent/tweet?text=%23opencompare&url=http://opencompare.org/pcm/'+id;
        $scope.facebookLink = 'https://www.facebook.com/sharer/sharer.php?u=http://opencompare.org/pcm/'+id;
        $scope.emailLink = 'mailto:?body=http://opencompare.org/pcm/'+id;
        $scope.googleLink = 'https://plus.google.com/share?url=http://opencompare.org/pcm/'+id;
        $scope.redditLink = 'http://www.reddit.com/submit?url=http://opencompare.org/pcm/'+id;
    };

    $scope.updateEmbedLink = function() {
        $scope.embedLink = '<iframe src="http://'+window.location.hostname+':'+window.location.port+'/embedPCM/'+id
            +'?enableEdit='+$scope.enableEditOption+'&enableExport='+$scope.enableExportOption+'&enableTitle='+$scope.enableTitleOption+'&enableShare='+$scope.enableShareOption
            +'" scrolling="no"  width="100%" height="700px" style="border:none;"></iframe>';
        //$scope.gridApi.selection.selectAllVisibleRows();
        //console.log($scope.gridApi.selection.getSelectedRows());
    }
});





/**
 * Created by gbecan on 3/26/15.
 */

pcmApp.controller("ToolbarCtrl", function($rootScope, $scope) {

    $scope.saved = false;
    $scope.isInDatabase = false;
    $scope.validating = false;
    $scope.edit = false;
    $scope.isTitleSet = false;

    /**
     * Save PCM on the server
     */
    $scope.save = function() {
        $rootScope.$broadcast('save');
    };

    /**
     * Remove PCM from server
     */
    $scope.remove = function() {
        $rootScope.$broadcast('remove');
    };

    /**
     * Cancel edition
     */
    $scope.cancel = function() {
        $rootScope.$broadcast('cancel');
    };

    /**
     * Export
     */
    $scope.export = function(format) {
        $rootScope.$broadcast('export', format);
    };
    /**
     * Validate the type of each columns
     */
    $scope.validate= function() {
        $rootScope.$broadcast('validate');
    };

    $scope.setEdit = function(bool, reload) {
        $scope.edit = bool;
        $rootScope.$broadcast('setGridEdit', [bool, reload]);
    };

    $scope.$on('modified', function(event, args) {
        $scope.saved = false;
    });
    $scope.$on('validating', function(event, args) {
        $scope.validating = !$scope.validating;
    });

    $scope.$on('completelyValidated', function(event, args) {
        $scope.validated = true;
    });

    $scope.$on('saved', function(event, args) {
        $scope.saved = true;
        $scope.isInDatabase = true;
    });

    $scope.$on('setToolbarEdit', function(event, args) {
        $scope.edit = args;
    });

    $scope.$on('setPcmName', function(event, args) {
        $scope.isTitleSet = args.length > 0;
        $scope.pcmName = args;
    });

});/**
 * Created by smangin on 19/05/15.
 */


pcmApp.controller("CsvExportController", function($rootScope, $scope, $http, $modal, $modalInstance) {

    $scope.loading = false;
    $scope.cancel = function() {
        $modalInstance.close();
    };

    // Default values
    $scope.title = "";
    $scope.productAsLines = true;
    $scope.separator = ',';
    $scope.quote = '"';

    $scope.valid = function(){

        $scope.export_content = "";
        $scope.loading = true;

        $http.post(
            "/api/export/csv",
            {
                file: JSON.stringify($scope.pcmObject),
                title: $scope.pcm.title,
                productAsLines: $scope.productAsLines,
                separator: $scope.separator,
                quote: $scope.quote
            }, {
                responseType: "text/plain",
                transformResponse: function(d, e) { // Needed to not interpret matrix as json (begin with '{|')
                    return d;
                }
            })
            .success(function(response, status, headers, config) {
                $scope.loading = false;
                $scope.export_content = response;
            }).error(function(data, status, headers, config) {
                $scope.loading = false;
                console.log(data)
            });
    }
});

/**
 * Created by smangin on 19/05/15.
 */

pcmApp.controller("WikitextExportController", function($rootScope, $scope, $http, $modal, $modalInstance) {
    $scope.loading = false;
    $scope.cancel = function() {
        $modalInstance.close();
    };

    // Default values
    $scope.title = "";
    $scope.export_content = "";
    $scope.productAsLines = true;

    $scope.valid = function(){

        $scope.export_content = "";
        $scope.loading = true;

        $http.post(
            "/api/export/wikitext",
            {
                file: JSON.stringify($scope.pcmObject),
                productAsLines: $scope.productAsLines
            }, {
                responseType: "text/plain",
                transformResponse: function(d, e) { // Needed to not interpret matrix as json (begin with '{|')
                    return d;
                }
            })
            .success(function(response, status, headers, config) {
                $scope.loading = false;
                $scope.export_content = response;
            }).error(function(data, status, headers, config) {
                $scope.loading = false;
                console.log(data)
            });
    }
});





/**
 * Created by smangin on 19/05/15.
 */


pcmApp.controller("CsvImportController", function($rootScope, $scope, $http, $modalInstance) {

    $scope.loading = false;
    $scope.cancel = function() {
        $modalInstance.close();
    };

    // Default values
    $scope.file = null;
    $scope.title = "";
    $scope.productAsLines = true;
    $scope.separator = ',';
    $scope.quote = '"';

    $scope.valid = function(){
        // Request must be a multipart form data !
        var fd = new FormData();
        fd.append('file', $scope.file);
        fd.append('title', $scope.title);
        fd.append('productAsLines', $scope.productAsLines);
        fd.append('separator', $scope.separator);
        fd.append('quote', $scope.quote);

        $scope.loading = true;

        $http.post(
            "/api/import/csv",
            fd,
            {
                transformRequest: angular.identity,
                headers: {'Content-Type': undefined}
            })
            .success(function(response, status, headers, config) {
                $scope.loading = false;
                var pcmContainer = response[0];
                $rootScope.$broadcast('import', pcmContainer);
                $modalInstance.close();
            }).error(function(data, status, headers, config) {
                $scope.loading = false;
                $scope.message = data
            });

    }
});

/**
 * Created by smangin on 19/05/15.
 */

pcmApp.controller("WikipediaImportController", function($rootScope, $scope, $http, $modalInstance, base64) {

    $scope.pcmContainers = [];
    $scope.pcmContainerNames = [];

    $scope.loading = false;
    $scope.cancel = function() {
        $modalInstance.close();
    };

    // Default values
    $scope.url = "";
    $scope.valid = function(){

        $scope.loading = true;

        $http.post(
            "/api/import/wikipedia",
            {
                url: $scope.url
            })
            .success(function(response, status, headers, config) {
                $scope.loading = false;
                $scope.pcmContainers = response;

                if (response.length === 1) {
                    $scope.selectPCM(0);
                } else {
                    $scope.pcmContainers.forEach(function (pcmContainer, containerIndex){
                        $scope.pcmContainerNames.push({
                            name: base64.decode(pcmContainer.pcm.name),
                            index: containerIndex
                        });
                    });
                }

            }).error(function(data, status, headers, config) {
                $scope.loading = false;
                $scope.message = data
            });
    };

    $scope.selectPCM = function(index) {
        var selectedPCMContainer = $scope.pcmContainers[index];
        $rootScope.$broadcast('import', selectedPCMContainer);
        $modalInstance.close();
    };
});





/**
 * Created by gbecan on 6/23/15.
 */

pcmApp.config(function ($translateProvider) {
    $translateProvider.translations('embedded', {

        'view.button.edit':'Edit',
        'edit.title':'Title',
        'edit.title.placeholder':'Title',
        'edit.title.createNewFeature':'Create a new feature',
        'edit.title.featureName':'Feature Name',
        'edit.title.featureType':'Feature type',
        'edit.title.renameFeature':'Rename',
        'edit.title.changeType':'Change type',
        'edit.title.selectRange':'Select a range to filter',
        'edit.title.from':'From',
        'edit.title.to':'To',
        'edit.title.selectProducts':'Select products to filter',
        'edit.title.embed':'Embed',
        'edit.title.showTitle':'Show title',
        'edit.title.allowEdition':'Allow edition',
        'edit.title.allowExportation':'Allow exportation',
        'edit.title.allowSharing':'Allow sharing',
        'edit.title.confirm':'Confirm',

        'edit.button.edit':'Edit',
        'edit.button.export':'Export',
        'edit.button.save':'Save',
        'edit.button.validate':'Validate',
        'edit.button.embed':'Embed',
        'edit.button.remove':'Remove',
        'edit.button.addfeature':'Add feature',
        'edit.button.addproduct':'Add product',
        'edit.button.cancel':'Cancel',
        'edit.button.apply':'Apply',
        'edit.button.confirm':'Are you sure?',
        'edit.button.no':'No',
        'edit.button.yes':'Yes',
        'edit.button.share':'Share',

        'edit.type.string':'String',
        'edit.type.boolean':'Boolean',
        'edit.type.number':'Number',


        'edit.warning.removeIsDefinitive':'Removing the comparison matrix is definitive and cannot be undone. Please, confirm.',
        'edit.warning.cancelWillLoseChanges':'Cancel will lose all unsaved changes are you sure?',
        'edit.validation.warning':'This value doesn\'t seem to match the feature type, validate if you want to keep it.',

        'importer.select':'Select a file to import',
        'importer.select.url':'Give a wikipedia matrix title',
        'importer.type':'Select a file extention',
        'importer.csv.separator':'Separator',
        'importer.csv.quote':'Quote',
        'importer.csv.header':'Has header ?',
        'importer.pcm.title':'Title',
        'importer.pcm.productAsLines':'Product as lines ?',
        'importer.button.getfile':'Select a file',
        'importer.button.cancel':'Cancel',
        'importer.button.confirm':'Confirm',
        'importer.button.confirm.message':'Are you sure to import?',
        'importer.button.confirm.desc':'Please, give a name to this new PCM and confirm.'

    });
    $translateProvider.useSanitizeValueStrategy('escaped');
    $translateProvider.useLoader('i18nLoader');
    $translateProvider.preferredLanguage('oc');
});

pcmApp.factory('i18nLoader', function($http, $q, $translate) {

    return function(options) {
        var deferred = $q.defer();

        $http.get("/api/i18n").success(function (data) {
            $translate.use('oc');
            return deferred.resolve(data);
        }).
        error(function(data, status, headers, config) {
                $translate.use('embedded');
        });

        return deferred.promise;
    }
});


pcmApp.controller("I18nCtrl", function($scope, $http) {

    $scope.changeLanguage = function(langKey) {
        $http.get("/api/i18n/" + langKey).success(function (data) {
            window.location.reload();
        });
    };


});/**
 * Created by hvallee on 7/2/15.
 */


pcmApp.service('embedService', function($rootScope) {

    this.initialize = function(data) {
        $rootScope.$broadcast('initializeFromExternalSource', data);
    };

    var enableEdit = false;
    this.enableEdit = function(bool) {
        return{
            get: enableEdit,
            set: function() {
                enableEdit = bool;
            }
        }
    };

    var enableExport = false;
    this.enableExport = function(bool) {
        return{
            get: enableExport,
            set: function() {
                enableExport = bool;
            }
        }
    };

    var enableShare = false;
    this.enableShare = function(bool) {
        return{
            get: enableShare,
            set: function() {
                enableShare = bool;
            }
        }
    };

    var setEdit = false;
    this.setEdit = function(bool) {
        return{
            get: setEdit,
            set: function() {
                setEdit = bool;
            }
        }
    };


});
/**
 * Created by hvallee on 7/3/15.
 */

pcmApp.service('expandeditor', function() {

    var afterCellEditFunctions = [];
    this.expandAfterCellEdit = function(functionToAdd) {
        return{
            afterCellEditFunctions: afterCellEditFunctions,
                addFunction: function() {
                    afterCellEditFunctions.push(functionToAdd);
            }
        }
    };

    var beginCellEditFunctions = [];
    this.expandBeginCellEdit = function(functionToAdd) {
        return{
            beginCellEditFunctions: beginCellEditFunctions,
                addFunction: function() {
                    beginCellEditFunctions.push(functionToAdd);
            }
        }
    };

    var columnMovedFunctions = [];
    this.expandColumnsMoved = function(functionToAdd) {
        return{
            columnMovedFunctions: columnMovedFunctions,
                addFunction: function() {
                    columnMovedFunctions.push(functionToAdd);
            }
        }
    };

    var navigateFunctions = [];
    this.expandNavigateFunctions = function(functionToAdd) {
        return{
            navigateFunctions: navigateFunctions,
            addFunction: function() {
                navigateFunctions.push(functionToAdd);
            }
        }
    };


});
/**
 * Created by hvallee on 7/6/15.
 */


pcmApp.service('typeService', function() {

    this.getType = function(featureName, data) {
        var rowIndex = 0;
        var isInt = 0;
        var isBool = 0;
        var isString = 0;
        var codedFeatureName = convertStringToEditorFormat(featureName);
        while(data[rowIndex]) {
            if(data[rowIndex][codedFeatureName]) {
                if (!angular.equals(parseInt(data[rowIndex][codedFeatureName]), NaN)) {
                    isInt++;
                }
                else if (this.isBooleanValue(data[rowIndex][codedFeatureName])) {
                    isBool++;
                }
                else if (!isEmptyCell(data[rowIndex][codedFeatureName])) {
                    isString++;
                }
            }
            rowIndex++;
        }
        var type = "";
        if(isInt > isBool) {
            if(isInt > isString) {
                type = "number";
            }
            else {
                type = "string";
            }
        }
        else if(isBool > isString) {
            type = "boolean";
        }
        else {
            type = "string";
        }
        return type;
    };

    this.validateType = function (productName, featureType) {

        var type = "";
        if(!angular.equals(parseInt(productName), NaN)) {
            type = "number";
        }
        else if(this.isBooleanValue(productName)) {
            type = "boolean";
        }
        else if(!isEmptyCell(productName)){
            type = "string";
        }
        else {
            type = "none"
        }
        if(type == "none") {
            return true;
        }
        else if (featureType == "string") {
            return true;
        }
        else {
            return type === featureType;
        }
    };

    this.isBooleanValue = function (productName) {

        return((productName.toLowerCase() === "yes") ||  (productName.toLowerCase() === "true") ||  (productName.toLowerCase() === "no") ||  (productName.toLowerCase() === "false"));
    };
});

/**
 * Created by hvallee on 6/19/15.
 */


    function getCellClass (value) {
        if(value) {
            if(value.toLowerCase().indexOf('yes') != -1 || value.toLowerCase().indexOf('oui') != -1) {
                return 'yesCell';
            }
            else if(value.toLowerCase().indexOf('no') != -1 || value.toLowerCase().indexOf('non') != -1) {
                return 'noCell';
            }
            else {
                return false;
            }
        }
        else {
            return false;
        }
    }

    function getCellTooltip (value) {

        if(value) {
            if(value.toLowerCase().indexOf('<ref') != -1) {
                var index = value.toLowerCase().indexOf('<ref');
                var refPart = value.substring(index+11);
                var endIndex = refPart.replace(/\s/g, '').indexOf('"/>');
                return refPart.substring(0, endIndex);
            }
            else if(value.toLowerCase().indexOf('<ref>{{') != -1) {
                var index = value.toLowerCase().indexOf('<ref>{{');
                var refPart = value.substring(index+11);
                var endIndex = refPart.replace(/\s/g, '').indexOf('}}</ref>');
                return refPart.substring(0, endIndex);
            }
            else if(value.toLowerCase().indexOf('<ref>{{') != -1) {
                var index = value.toLowerCase().indexOf('<ref>{{');
                var refPart = value.substring(index+11);
                var endIndex = refPart.replace(/\s/g, '').indexOf('}}</ref>');
                return refPart.substring(0, endIndex);
            }
            else {
                return false;
            }
        }
        else {
            return false;
        }

    }

    function sortProducts(products, position) {
        var sortedProducts = [];
        position.sort(function (a, b) {
            if(a.position == -1) {
                return 1;
            }
            else if(b.position == -1) {
                return -1;
            }
            else {
                return a.position - b.position;
            }
        });
        for(var i = 0; i < position.length; i++) {
            products.forEach(function (product) {
                if(position[i].product == product.name) {
                    sortedProducts.push(product);
                }
            });
        }
        return sortedProducts;
    }

    function sortRawProducts(rawProducts, products) {
        var sortedProducts = [];
        products.forEach(function (product) {
            rawProducts.forEach(function (rawProduct) {
                if (rawProduct.name == product.name) {
                    sortedProducts.push(rawProduct);
                }
            });
        });
        return sortedProducts;
    }

    function sortFeatures(columns, position){
        var sortedColumns = [];
        position.sort(function (a, b) {
            if(a.position == -1) {
                return 1;
            }
            else if(b.position == -1) {
                return -1;
            }
            else {
                return a.position - b.position;
            }
        });
        for(var i = 0; i < position.length; i++) {
            columns.forEach(function (feature) {
                var featureName = convertStringToEditorFormat(position[i].feature.toString());
                if(position[i].feature == "") {
                    featureName = " ";
                }
                if(featureName == feature.name) {
                    sortedColumns.push(feature);
                }
            });
        }
        return sortedColumns;
    }

    function convertStringToEditorFormat(name) {

        return name.replace(/\(/g, '%28').replace(/\)/g, '%29');
    }

    function convertStringToPCMFormat(name) {

        return name.replace(/%28/g, '(').replace(/%29/g, ')');
    }

    function findMinAndMax(featureName, data) {

        var min = 0;
        var max = 0;
        data.forEach(function (product) {
            if(parseInt(product[featureName]) > max) {
                max = parseFloat(product[featureName].replace(/\s/g, "").replace(",", "."));
            }
            if(parseInt(product[featureName]) < min) {
                min = parseFloat(product[featureName].replace(/\s/g, "").replace(",", "."));
            }
        });
        return [min, max];
    }

    /* Move object in array */
    Array.prototype.move = function (old_index, new_index) {

        if (new_index >= this.length) {
            var k = new_index - this.length;
            while ((k--) + 1) {
                this.push(undefined);
            }
        }
        this.splice(new_index, 0, this.splice(old_index, 1)[0]);
        return this;
    };

    function isEmptyCell(name) {

        return (!name.toLowerCase()
        || name.toLowerCase() == ""
        || name.toLowerCase() == "N/A"
        || name.toLowerCase() == "?"
        || name.toLowerCase() == "unknown");
    }

    function checkIfNameExists(name, columns) {

        var newName = "";
        if(!name) {
            newName = "New Feature";
        }
        else {
            newName = name;
        }
        var index = 0;
        columns.forEach(function(featureData) {
            var featureDataWithoutNumbers = featureData.name.replace(/[0-9]/g, '');
            if(featureDataWithoutNumbers === newName ){
                index++;
            }
        });
        if(index != 0) {
            newName = newName + index;
        }
        return newName;
    }

    function GetUrlValue(VarSearch){
        var SearchString = document.location.search.substring(1);
        var VariableArray = SearchString.split('&');
        for(var i = 0; i < VariableArray.length; i++){
            var KeyValuePair = VariableArray[i].split('=');
            if(KeyValuePair[0] == VarSearch){
                return KeyValuePair[1];
            }
        }
    }


/**
 * Created by hvallee on 6/19/15.
 */

    pcmApp.directive('openCompareEditor', function() {
        return {
            templateUrl: '/assets/templates/pcmEditor.html'
        };
    });

    pcmApp.directive('embedOpenCompareEditor', function() {
        return {
            templateUrl: '/assets/templates/pcmEditor.html'
        };
    });/**
 * Created by smangin on 19/05/15.
 */


pcmApp.directive('fileModel', ['$parse', function ($parse) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var model = $parse(attrs.fileModel);
            var modelSetter = model.assign;

            element.bind('change', function(){
                scope.$apply(function(){
                    modelSetter(scope, element[0].files[0]);
                });
            });
        }
    };
}]);pcmApp.service('pcmApi', function(base64) {
    /**
     * Sort two elements by their names (accessed with x.name)
     * @param a
     * @param b
     * @returns {number}
     */
    this.sortByName = function (a, b) {
        if (a.name < b.name) {
            return -1;
        } else if (a.name > b.name) {
            return 1;
        } else {
            return 0;
        }
    };


    this.createFeature = function (name, pcm, factory) {
        // Create feature
        var feature = factory.createFeature();
        feature.name = name;
        pcm.addFeatures(feature);

        // Create corresponding cells for all products
        for (var i = 0; i < pcm.products.array.length; i++) {
            var cell = factory.createCell();
            cell.content = "";
            cell.feature = feature;
            pcm.products.array[i].addValues(cell);
        }

        return feature;
    };

    this.getConcreteFeatures = function (pcm) {

        function getConcreteFeaturesRec(aFeature) {
            var features = [];

            if (typeof aFeature.subFeatures !== 'undefined') {
                var subFeatures = aFeature.subFeatures.array;
                for (var i = 0; i < subFeatures.length; i++) {
                    var subFeature = subFeatures[i];
                    features = features.concat(getConcreteFeaturesRec(subFeature));
                }
            } else {
                features.push(aFeature);
            }

            return features;
        }

        var aFeatures = pcm.features.array;

        var features = [];
        for (var i = 0; i < aFeatures.length; i++) {
            var aFeature = aFeatures[i];
            features = features.concat(getConcreteFeaturesRec(aFeature))
        }

        return features;
    };

    this.findCell = function (product, feature) {
        var cells = product.cells.array;
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (cell.feature.name === feature.name) {
                return cell;
            }
        }
    };

    this.encodePCM = function (pcm) {
        this.base64PCMVisitor(pcm, true);
        return pcm;
    };

    this.decodePCM = function (pcm) {
        this.base64PCMVisitor(pcm, false);
        return pcm;
    };

    this.base64PCMVisitor = function (pcm, encoding) {
        function encodeToBase64(str, encoding) {
            if (encoding) {
                return base64.encode(str);
            } else {
                return base64.decode(str);
            }
        }

        function base64FeatureVisitor(feature, encoding) {
            feature.name = encodeToBase64(feature.name, encoding);

            if (typeof feature.subFeatures !== 'undefined') {
                feature.subFeatures.array.forEach(function (subFeature) {
                    base64FeatureVisitor(subFeature, encoding);
                });
            }
        }

        pcm.name = encodeToBase64(pcm.name, encoding);
        pcm.features.array.forEach(function (feature) {
            base64FeatureVisitor(feature, encoding);
        });

        pcm.products.array.forEach(function (product) {
            product.name = encodeToBase64(product.name, encoding);
            product.cells.array.forEach(function (cell) {
                cell.content = encodeToBase64(cell.content, encoding);
                cell.rawContent = encodeToBase64(cell.rawContent, encoding);
            });
        });
    };


});

var Kotlin={};
(function(){function b(a,b){if(null!=a&&null!=b)for(var m in b)b.hasOwnProperty(m)&&(a[m]=b[m])}function a(a){for(var b=0;b<a.length;b++)if(null!=a[b]&&null==a[b].$metadata$||a[b].$metadata$.type===Kotlin.TYPE.CLASS)return a[b];return null}function D(a,b,m){for(var l=0;l<b.length;l++)if(null==b[l]||null!=b[l].$metadata$){var h=m(b[l]),n;for(n in h)h.hasOwnProperty(n)&&(!a.hasOwnProperty(n)||a[n].$classIndex$<h[n].$classIndex$)&&(a[n]=h[n])}}function B(b,m){var l={};l.baseClasses=null==b?[]:Array.isArray(b)?
b:[b];l.baseClass=a(l.baseClasses);l.classIndex=Kotlin.newClassIndex();l.functions={};l.properties={};if(null!=m)for(var h in m)if(m.hasOwnProperty(h)){var p=m[h];p.$classIndex$=l.classIndex;"function"===typeof p?l.functions[h]=p:l.properties[h]=p}D(l.functions,l.baseClasses,function(a){return a.$metadata$.functions});D(l.properties,l.baseClasses,function(a){return a.$metadata$.properties});return l}function m(){var a=this.object_initializer$();Object.defineProperty(this,"object",{value:a});return a}
function p(a){return"function"===typeof a?a():a}function l(a,b){if(null!=a&&null==a.$metadata$||a.$metadata$.classIndex<b.$metadata$.classIndex)return!1;var m=a.$metadata$.baseClasses,h;for(h=0;h<m.length;h++)if(m[h]===b)return!0;for(h=0;h<m.length;h++)if(l(m[h],b))return!0;return!1}function h(a,b){return function(){if(null!==b){var m=b;b=null;m.call(a)}return a}}function q(a){var b={};if(null==a)return b;for(var m in a)a.hasOwnProperty(m)&&("function"===typeof a[m]?a[m].type===Kotlin.TYPE.INIT_FUN?
(a[m].className=m,Object.defineProperty(b,m,{get:a[m],configurable:!0})):b[m]=a[m]:Object.defineProperty(b,m,a[m]));return b}var v=function(){return function(){}};Kotlin.TYPE={CLASS:"class",TRAIT:"trait",OBJECT:"object",INIT_FUN:"init fun"};Kotlin.classCount=0;Kotlin.newClassIndex=function(){var a=Kotlin.classCount;Kotlin.classCount++;return a};Kotlin.createClassNow=function(a,l,h,r){null==l&&(l=v());b(l,r);a=B(a,h);a.type=Kotlin.TYPE.CLASS;h=null!==a.baseClass?Object.create(a.baseClass.prototype):
{};Object.defineProperties(h,a.properties);b(h,a.functions);h.constructor=l;null!=a.baseClass&&(l.baseInitializer=a.baseClass);l.$metadata$=a;l.prototype=h;Object.defineProperty(l,"object",{get:m,configurable:!0});return l};Kotlin.createObjectNow=function(a,b,m){a=new (Kotlin.createClassNow(a,b,m));a.$metadata$={type:Kotlin.TYPE.OBJECT};return a};Kotlin.createTraitNow=function(a,l,h){var r=function(){};b(r,h);r.$metadata$=B(a,l);r.$metadata$.type=Kotlin.TYPE.TRAIT;r.prototype={};Object.defineProperties(r.prototype,
r.$metadata$.properties);b(r.prototype,r.$metadata$.functions);Object.defineProperty(r,"object",{get:m,configurable:!0});return r};Kotlin.createClass=function(a,b,m,l){function h(){var n=Kotlin.createClassNow(p(a),b,m,l);Object.defineProperty(this,h.className,{value:n});return n}h.type=Kotlin.TYPE.INIT_FUN;return h};Kotlin.createTrait=function(a,b,m){function l(){var h=Kotlin.createTraitNow(p(a),b,m);Object.defineProperty(this,l.className,{value:h});return h}l.type=Kotlin.TYPE.INIT_FUN;return l};
Kotlin.createObject=function(a,b,m){return Kotlin.createObjectNow(p(a),b,m)};Kotlin.callGetter=function(a,b,m){return b.$metadata$.properties[m].get.call(a)};Kotlin.callSetter=function(a,b,m,l){b.$metadata$.properties[m].set.call(a,l)};Kotlin.isType=function(a,b){return null==a||null==b?!1:a instanceof b?!0:null!=b&&null==b.$metadata$||b.$metadata$.type==Kotlin.TYPE.CLASS?!1:l(a.constructor,b)};Kotlin.modules={};Kotlin.definePackage=function(a,b){var m=q(b);return null===a?{value:m}:{get:h(m,a)}};
Kotlin.defineRootPackage=function(a,b){var m=q(b);m.$initializer$=null===a?v():a;return m};Kotlin.defineModule=function(a,b){if(a in Kotlin.modules)throw Error("Module "+a+" is already defined");b.$initializer$.call(b);Object.defineProperty(Kotlin.modules,a,{value:b})}})();
(function(){function b(a){return function(){throw new TypeError(void 0!==a?"Function "+a+" is abstract":"Function is abstract");}}String.prototype.startsWith=function(a){return 0===this.indexOf(a)};String.prototype.endsWith=function(a){return-1!==this.indexOf(a,this.length-a.length)};String.prototype.contains=function(a){return-1!==this.indexOf(a)};Kotlin.equals=function(a,b){return null==a?null==b:Array.isArray(a)?Kotlin.arrayEquals(a,b):"object"==typeof a&&void 0!==a.equals_za3rmp$?a.equals_za3rmp$(b):
a===b};Kotlin.toString=function(a){return null==a?"null":Array.isArray(a)?Kotlin.arrayToString(a):a.toString()};Kotlin.arrayToString=function(a){return"["+a.join(", ")+"]"};Kotlin.intUpto=function(a,b){return new Kotlin.NumberRange(a,b)};Kotlin.intDownto=function(a,b){return new Kotlin.Progression(a,b,-1)};Kotlin.RuntimeException=Kotlin.createClassNow();Kotlin.NullPointerException=Kotlin.createClassNow();Kotlin.NoSuchElementException=Kotlin.createClassNow();Kotlin.IllegalArgumentException=Kotlin.createClassNow();
Kotlin.IllegalStateException=Kotlin.createClassNow();Kotlin.UnsupportedOperationException=Kotlin.createClassNow();Kotlin.IOException=Kotlin.createClassNow();Kotlin.throwNPE=function(){throw new Kotlin.NullPointerException;};Kotlin.Iterator=Kotlin.createClassNow(null,null,{next:b("Iterator#next"),hasNext:b("Iterator#hasNext")});var a=Kotlin.createClassNow(Kotlin.Iterator,function(a){this.array=a;this.index=0},{next:function(){return this.array[this.index++]},hasNext:function(){return this.index<this.array.length},
remove:function(){if(0>this.index||this.index>this.array.length)throw new RangeError;this.index--;this.array.splice(this.index,1)}}),D=Kotlin.createClassNow(a,function(a){this.list=a;this.size=a.size();this.index=0},{next:function(){return this.list.get(this.index++)}});Kotlin.Collection=Kotlin.createClassNow();Kotlin.Enum=Kotlin.createClassNow(null,function(){this.ordinal$=this.name$=void 0},{name:function(){return this.name$},ordinal:function(){return this.ordinal$},toString:function(){return this.name()}});
(function(){function a(b){return this[b]}function b(){return this.values$}Kotlin.createEnumEntries=function(l){var h=0,q=[],v;for(v in l)if(l.hasOwnProperty(v)){var y=l[v];q[h]=y;y.ordinal$=h;y.name$=v;h++}l.values$=q;l.valueOf_61zpoe$=a;l.values=b;return l}})();Kotlin.PropertyMetadata=Kotlin.createClassNow(null,function(a){this.name=a});Kotlin.AbstractCollection=Kotlin.createClassNow(Kotlin.Collection,null,{addAll_xeylzf$:function(a){var b=!1;for(a=a.iterator();a.hasNext();)this.add_za3rmp$(a.next())&&
(b=!0);return b},removeAll_xeylzf$:function(a){for(var b=!1,l=this.iterator();l.hasNext();)a.contains_za3rmp$(l.next())&&(l.remove(),b=!0);return b},retainAll_xeylzf$:function(a){for(var b=!1,l=this.iterator();l.hasNext();)a.contains_za3rmp$(l.next())||(l.remove(),b=!0);return b},containsAll_xeylzf$:function(a){for(a=a.iterator();a.hasNext();)if(!this.contains_za3rmp$(a.next()))return!1;return!0},isEmpty:function(){return 0===this.size()},iterator:function(){return new a(this.toArray())},equals_za3rmp$:function(a){if(this.size()!==
a.size())return!1;var b=this.iterator();a=a.iterator();for(var l=this.size();0<l--;)if(!Kotlin.equals(b.next(),a.next()))return!1;return!0},toString:function(){for(var a="[",b=this.iterator(),l=!0,h=this.size();0<h--;)l?l=!1:a+=", ",a+=b.next();return a+"]"},toJSON:function(){return this.toArray()}});Kotlin.AbstractList=Kotlin.createClassNow(Kotlin.AbstractCollection,null,{iterator:function(){return new D(this)},remove_za3rmp$:function(a){a=this.indexOf_za3rmp$(a);return-1!==a?(this.remove_za3lpa$(a),
!0):!1},contains_za3rmp$:function(a){return-1!==this.indexOf_za3rmp$(a)}});Kotlin.ArrayList=Kotlin.createClassNow(Kotlin.AbstractList,function(){this.array=[]},{get_za3lpa$:function(a){this.checkRange(a);return this.array[a]},get:function(a){return this.get_za3lpa$(a)},set_vux3hl$:function(a,b){this.checkRange(a);this.array[a]=b},size:function(){return this.array.length},iterator:function(){return Kotlin.arrayIterator(this.array)},add_za3rmp$:function(a){this.array.push(a);return!0},add_vux3hl$:function(a,
b){this.array.splice(a,0,b)},addAll_xeylzf$:function(a){var b=a.iterator(),l=this.array.length;for(a=a.size();0<a--;)this.array[l++]=b.next()},remove_za3lpa$:function(a){this.checkRange(a);return this.array.splice(a,1)[0]},clear:function(){this.array.length=0},indexOf_za3rmp$:function(a){for(var b=0;b<this.array.length;b++)if(Kotlin.equals(this.array[b],a))return b;return-1},lastIndexOf_za3rmp$:function(a){for(var b=this.array.length-1;0<=b;b--)if(Kotlin.equals(this.array[b],a))return b;return-1},
toArray:function(){return this.array.slice(0)},toString:function(){return"["+this.array.join(", ")+"]"},toJSON:function(){return this.array},checkRange:function(a){if(0>a||a>=this.array.length)throw new RangeError;}});Kotlin.Runnable=Kotlin.createClassNow(null,null,{run:b("Runnable#run")});Kotlin.Comparable=Kotlin.createClassNow(null,null,{compareTo:b("Comparable#compareTo")});Kotlin.Appendable=Kotlin.createClassNow(null,null,{append:b("Appendable#append")});Kotlin.Closeable=Kotlin.createClassNow(null,
null,{close:b("Closeable#close")});Kotlin.safeParseInt=function(a){a=parseInt(a,10);return isNaN(a)?null:a};Kotlin.safeParseDouble=function(a){a=parseFloat(a);return isNaN(a)?null:a};Kotlin.arrayEquals=function(a,b){if(a===b)return!0;if(!Array.isArray(b)||a.length!==b.length)return!1;for(var l=0,h=a.length;l<h;l++)if(!Kotlin.equals(a[l],b[l]))return!1;return!0};Kotlin.System=function(){var a="",b=function(b){void 0!==b&&(a=null===b||"object"!==typeof b?a+b:a+b.toString())},l=function(b){this.print(b);
a+="\n"};return{out:function(){return{print:b,println:l}},output:function(){return a},flush:function(){a=""}}}();Kotlin.println=function(a){Kotlin.System.out().println(a)};Kotlin.print=function(a){Kotlin.System.out().print(a)};Kotlin.RangeIterator=Kotlin.createClassNow(Kotlin.Iterator,function(a,b,l){this.start=a;this.end=b;this.increment=l;this.i=a},{next:function(){var a=this.i;this.i+=this.increment;return a},hasNext:function(){return this.i<=this.end}});Kotlin.NumberRange=Kotlin.createClassNow(null,
function(a,b){this.start=a;this.end=b;this.increment=1},{contains:function(a){return this.start<=a&&a<=this.end},iterator:function(){return new Kotlin.RangeIterator(this.start,this.end)}});Kotlin.Progression=Kotlin.createClassNow(null,function(a,b,l){this.start=a;this.end=b;this.increment=l},{iterator:function(){return new Kotlin.RangeIterator(this.start,this.end,this.increment)}});Kotlin.Comparator=Kotlin.createClassNow(null,null,{compare:b("Comparator#compare")});var B=Kotlin.createClassNow(Kotlin.Comparator,
function(a){this.compare=a});Kotlin.comparator=function(a){return new B(a)};Kotlin.collectionsMax=function(a,b){if(a.isEmpty())throw Error();for(var l=a.iterator(),h=l.next();l.hasNext();){var q=l.next();0>b.compare(h,q)&&(h=q)}return h};Kotlin.collectionsSort=function(a,b){var l=void 0;void 0!==b&&(l=b.compare.bind(b));a instanceof Array&&a.sort(l);for(var h=[],q=a.iterator();q.hasNext();)h.push(q.next());h.sort(l);l=0;for(q=h.length;l<q;l++)a.set_vux3hl$(l,h[l])};Kotlin.copyToArray=function(a){var b=
[];for(a=a.iterator();a.hasNext();)b.push(a.next());return b};Kotlin.StringBuilder=Kotlin.createClassNow(null,function(){this.string=""},{append:function(a){this.string+=a.toString();return this},toString:function(){return this.string}});Kotlin.splitString=function(a,b,l){return a.split(RegExp(b),l)};Kotlin.nullArray=function(a){for(var b=[];0<a;)b[--a]=null;return b};Kotlin.numberArrayOfSize=function(a){return Kotlin.arrayFromFun(a,function(){return 0})};Kotlin.charArrayOfSize=function(a){return Kotlin.arrayFromFun(a,
function(){return"\x00"})};Kotlin.booleanArrayOfSize=function(a){return Kotlin.arrayFromFun(a,function(){return!1})};Kotlin.arrayFromFun=function(a,b){for(var l=Array(a),h=0;h<a;h++)l[h]=b(h);return l};Kotlin.arrayIndices=function(a){return new Kotlin.NumberRange(0,a.length-1)};Kotlin.arrayIterator=function(b){return new a(b)};Kotlin.jsonFromTuples=function(a){for(var b=a.length,l={};0<b;)--b,l[a[b][0]]=a[b][1];return l};Kotlin.jsonAddProperties=function(a,b){for(var l in b)b.hasOwnProperty(l)&&(a[l]=
b[l]);return a}})();
(function(){function b(a){if("string"==typeof a)return a;if("function"==typeof a.hashCode)return a=a.hashCode(),"string"==typeof a?a:b(a);if("function"==typeof a.toString)return a.toString();try{return String(a)}catch(m){return Object.prototype.toString.call(a)}}function a(a,b){return a.equals(b)}function D(a,b){return"function"==typeof b.equals?b.equals(a):a===b}function B(a){return function(b){if(null===b)throw Error("null is not a valid "+a);if("undefined"==typeof b)throw Error(a+" must not be undefined");
}}function m(a,b,f,d){this[0]=a;this.entries=[];this.addEntry(b,f);null!==d&&(this.getEqualityFunction=function(){return d})}function p(a){return function(b){for(var f=this.entries.length,d,c=this.getEqualityFunction(b);f--;)if(d=this.entries[f],c(b,d[0]))switch(a){case w:return!0;case u:return d;case r:return[f,d[1]]}return!1}}function l(a){return function(b){for(var f=b.length,d=0,c=this.entries.length;d<c;++d)b[f+d]=this.entries[d][a]}}function h(a,b){var f=a[b];return f&&f instanceof m?f:null}
var q="function"==typeof Array.prototype.splice?function(a,b){a.splice(b,1)}:function(a,b){var f,d,c;if(b===a.length-1)a.length=b;else for(f=a.slice(b+1),a.length=b,d=0,c=f.length;d<c;++d)a[b+d]=f[d]},v=B("key"),y=B("value"),w=0,u=1,r=2;m.prototype={getEqualityFunction:function(b){return"function"==typeof b.equals?a:D},getEntryForKey:p(u),getEntryAndIndexForKey:p(r),removeEntryForKey:function(a){return(a=this.getEntryAndIndexForKey(a))?(q(this.entries,a[0]),a[1]):null},addEntry:function(a,b){this.entries[this.entries.length]=
[a,b]},keys:l(0),values:l(1),getEntries:function(a){for(var b=a.length,f=0,d=this.entries.length;f<d;++f)a[b+f]=this.entries[f].slice(0)},containsKey_za3rmp$:p(w),containsValue_za3rmp$:function(a){for(var b=this.entries.length;b--;)if(a===this.entries[b][1])return!0;return!1}};var t=function(a,l){var f=this,d=[],c={},e="function"==typeof a?a:b,g="function"==typeof l?l:null;this.put_wn2jw4$=function(f,a){v(f);y(a);var b=e(f),l,n=null;(l=h(c,b))?(b=l.getEntryForKey(f))?(n=b[1],b[1]=a):l.addEntry(f,
a):(l=new m(b,f,a,g),d[d.length]=l,c[b]=l);return n};this.get_za3rmp$=function(f){v(f);var a=e(f);if(a=h(c,a))if(f=a.getEntryForKey(f))return f[1];return null};this.containsKey_za3rmp$=function(f){v(f);var a=e(f);return(a=h(c,a))?a.containsKey_za3rmp$(f):!1};this.containsValue_za3rmp$=function(f){y(f);for(var a=d.length;a--;)if(d[a].containsValue_za3rmp$(f))return!0;return!1};this.clear=function(){d.length=0;c={}};this.isEmpty=function(){return!d.length};var k=function(f){return function(){for(var a=
[],b=d.length;b--;)d[b][f](a);return a}};this._keys=k("keys");this._values=k("values");this._entries=k("getEntries");this.values=function(){for(var f=this._values(),a=f.length,d=new Kotlin.ArrayList;a--;)d.add_za3rmp$(f[a]);return d};this.remove_za3rmp$=function(f){v(f);var a=e(f),b=null,m=h(c,a);if(m&&(b=m.removeEntryForKey(f),null!==b&&!m.entries.length)){a:{for(f=d.length;f--;)if(m=d[f],a===m[0])break a;f=null}q(d,f);delete c[a]}return b};this.size=function(){for(var f=0,a=d.length;a--;)f+=d[a].entries.length;
return f};this.each=function(a){for(var d=f._entries(),b=d.length,c;b--;)c=d[b],a(c[0],c[1])};this.putAll_za3j1t$=function(a,d){for(var b=a._entries(),c,e,m,g=b.length,l="function"==typeof d;g--;)c=b[g],e=c[0],c=c[1],l&&(m=f.get(e))&&(c=d(e,m,c)),f.put_wn2jw4$(e,c)};this.clone=function(){var d=new t(a,l);d.putAll_za3j1t$(f);return d};this.keySet=function(){for(var f=new Kotlin.ComplexHashSet,a=this._keys(),d=a.length;d--;)f.add_za3rmp$(a[d]);return f}};Kotlin.HashTable=t})();Kotlin.Map=Kotlin.createClassNow();
Kotlin.HashMap=Kotlin.createClassNow(Kotlin.Map,function(){Kotlin.HashTable.call(this)});Kotlin.ComplexHashMap=Kotlin.HashMap;
(function(){var b=Kotlin.createClassNow(Kotlin.Iterator,function(a,b){this.map=a;this.keys=b;this.size=b.length;this.index=0},{next:function(){return this.map[this.keys[this.index++]]},hasNext:function(){return this.index<this.size}}),a=Kotlin.createClassNow(Kotlin.Collection,function(a){this.map=a},{iterator:function(){return new b(this.map.map,Object.keys(this.map.map))},isEmpty:function(){return 0===this.map.$size},contains:function(a){return this.map.containsValue_za3rmp$(a)}});Kotlin.PrimitiveHashMap=
Kotlin.createClassNow(Kotlin.Map,function(){this.$size=0;this.map={}},{size:function(){return this.$size},isEmpty:function(){return 0===this.$size},containsKey_za3rmp$:function(a){return void 0!==this.map[a]},containsValue_za3rmp$:function(a){var b=this.map,m;for(m in b)if(b.hasOwnProperty(m)&&b[m]===a)return!0;return!1},get_za3rmp$:function(a){return this.map[a]},put_wn2jw4$:function(a,b){var m=this.map[a];this.map[a]=void 0===b?null:b;void 0===m&&this.$size++;return m},remove_za3rmp$:function(a){var b=
this.map[a];void 0!==b&&(delete this.map[a],this.$size--);return b},clear:function(){this.$size=0;this.map={}},putAll_za3j1t$:function(a){a=a.map;for(var b in a)a.hasOwnProperty(b)&&(this.map[b]=a[b],this.$size++)},keySet:function(){var a=new Kotlin.PrimitiveHashSet,b=this.map,m;for(m in b)b.hasOwnProperty(m)&&a.add_za3rmp$(m);return a},values:function(){return new a(this)},toJSON:function(){return this.map}})})();Kotlin.Set=Kotlin.createClassNow(Kotlin.Collection);
var SetIterator=Kotlin.createClassNow(Kotlin.Iterator,function(b){this.set=b;this.keys=b.toArray();this.index=0},{next:function(){return this.keys[this.index++]},hasNext:function(){return this.index<this.keys.length},remove:function(){this.set.remove_za3rmp$(this.keys[this.index-1])}});
Kotlin.PrimitiveHashSet=Kotlin.createClassNow(Kotlin.AbstractCollection,function(){this.$size=0;this.map={}},{contains_s9cetl$:function(b){return!0===this.map[b]},iterator:function(){return new SetIterator(this)},size:function(){return this.$size},add_za3rmp$:function(b){var a=this.map[b];this.map[b]=!0;if(!0===a)return!1;this.$size++;return!0},remove_za3rmp$:function(b){return!0===this.map[b]?(delete this.map[b],this.$size--,!0):!1},clear:function(){this.$size=0;this.map={}},toArray:function(){return Object.keys(this.map)}});
(function(){function b(a,D){var B=new Kotlin.HashTable(a,D);this.addAll_xeylzf$=Kotlin.AbstractCollection.prototype.addAll_xeylzf$;this.removeAll_xeylzf$=Kotlin.AbstractCollection.prototype.removeAll_xeylzf$;this.retainAll_xeylzf$=Kotlin.AbstractCollection.prototype.retainAll_xeylzf$;this.containsAll_xeylzf$=Kotlin.AbstractCollection.prototype.containsAll_xeylzf$;this.add_za3rmp$=function(a){return!B.put_wn2jw4$(a,!0)};this.toArray=function(){return B._keys()};this.iterator=function(){return new SetIterator(this)};
this.remove_za3rmp$=function(a){return null!=B.remove_za3rmp$(a)};this.contains_za3rmp$=function(a){return B.containsKey_za3rmp$(a)};this.clear=function(){B.clear()};this.size=function(){return B.size()};this.isEmpty=function(){return B.isEmpty()};this.clone=function(){var m=new b(a,D);m.addAll_xeylzf$(B.keys());return m};this.equals=function(a){if(null===a||void 0===a)return!1;if(this.size()===a.size()){var b=this.iterator();for(a=a.iterator();;){var l=b.hasNext(),h=a.hasNext();if(l!=h)break;if(h){if(l=
b.next(),h=a.next(),!Kotlin.equals(l,h))break}else return!0}}return!1};this.toString=function(){for(var a="[",b=this.iterator(),l=!0;b.hasNext();)l?l=!1:a+=", ",a+=b.next();return a+"]"};this.intersection=function(m){var p=new b(a,D);m=m.values();for(var l=m.length,h;l--;)h=m[l],B.containsKey_za3rmp$(h)&&p.add_za3rmp$(h);return p};this.union=function(a){var b=this.clone();a=a.values();for(var l=a.length,h;l--;)h=a[l],B.containsKey_za3rmp$(h)||b.add_za3rmp$(h);return b};this.isSubsetOf=function(a){for(var b=
B.keys(),l=b.length;l--;)if(!a.contains_za3rmp$(b[l]))return!1;return!0}}Kotlin.HashSet=Kotlin.createClassNow(Kotlin.Set,function(){b.call(this)});Kotlin.ComplexHashSet=Kotlin.HashSet})();
(function(b){var a=b.defineRootPackage(null,{js:b.definePackage(null,{toChar_mz3mef$:function(a){return a},lastIndexOf_orzsrp$:function(a,b,m){return a.lastIndexOf(b.toString(),m)},lastIndexOf_960177$:function(a,b){return a.lastIndexOf(b.toString())},indexOf_960177$:function(a,b){return a.indexOf(b.toString())},indexOf_orzsrp$:function(a,b,m){return a.indexOf(b.toString(),m)},matches_94jgcu$:function(a,b){var m=a.match(b);return null!=m&&0<m.length},capitalize_pdl1w0$:function(b){return a.kotlin.isNotEmpty_pdl1w0$(b)?
b.substring(0,1).toUpperCase()+b.substring(1):b},decapitalize_pdl1w0$:function(b){return a.kotlin.isNotEmpty_pdl1w0$(b)?b.substring(0,1).toLowerCase()+b.substring(1):b}}),java:b.definePackage(null,{lang:b.definePackage(function(){this.Long=b.createObject(null,null,{parseLong:function(a){return a}});this.Integer=b.createObject(null,null,{parseInt:function(a){return a}})},{}),util:b.definePackage(null,{concurrent:b.definePackage(null,{ConcurrentHashMap:b.createClass(function(){return[b.HashMap]},function B(){B.baseInitializer.call(this)})}),
IdentityHashMap:b.createClass(function(){return[b.HashMap]},function m(){m.baseInitializer.call(this)}),HashSet_xeylzf$:function(a){var p=new b.ComplexHashSet(a.size());p.addAll_xeylzf$(a);return p},LinkedHashSet_xeylzf$:function(a){var p=new b.LinkedHashSet(a.size());p.addAll_xeylzf$(a);return p},HashMap_za3j1t$:function(a){var p=new b.ComplexHashMap(a.size());p.putAll_za3j1t$(a);return p},LinkedHashMap_za3j1t$:function(a){var p=new b.LinkedHashMap(a.size());p.putAll_za3j1t$(a);return p}}),io:b.definePackage(null,
{InputStream:b.createTrait(null),OutputStream:b.createTrait(null),BufferedOutputStream:b.createClass(function(){return[a.java.io.OutputStream]},function(a){this.oo=a},{write:function(a){this.oo.result=a}}),ByteArrayInputStream:b.createClass(function(){return[a.java.io.InputStream]},function(a){this.inputBytes=a},{readBytes:function(){return this.inputBytes}}),ByteArrayOutputStream:b.createClass(function(){return[a.java.io.OutputStream]},function(){this.result=""},{flush:function(){},close:function(){},
toString:function(){return this.result}}),PrintStream:b.createClass(null,function(a,b){this.oo=a;this.result=""},{println:function(){this.result+="\n"},print_4:function(a){this.result+=a},println_2:function(a){this.print_4(a);this.println()},print_1:function(a){this.result+=a},print_2:function(a){this.result+=a},print_3:function(a){this.result+=a},print:function(a){this.result=a?this.result+"true":this.result+"false"},println_1:function(a){this.print_1(a);this.println()},flush:function(){this.oo.write(this.result)},
close:function(){}})})}),pcm:b.definePackage(null,{PCM:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFContainer]},{name:{get:function(){return this.$name_unk2qb$},set:function(a){this.$name_unk2qb$=a}},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_urnifi$},set:function(a){this.$generated_KMF_ID_urnifi$=a}},products:{get:function(){return this.$products_jth36c$},set:function(a){this.$products_jth36c$=a}},features:{get:function(){return this.$features_80wu4b$},set:function(a){this.$features_80wu4b$=
a}}}),Product:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFContainer]},{name:{get:function(){return this.$name_jd6bz6$},set:function(a){this.$name_jd6bz6$=a}},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_cztrbt$},set:function(a){this.$generated_KMF_ID_cztrbt$=a}},cells:{get:function(){return this.$cells_w9j2jm$},set:function(a){this.$cells_w9j2jm$=a}}}),AbstractFeature:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFContainer]},{name:{get:function(){return this.$name_7wovax$},
set:function(a){this.$name_7wovax$=a}},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_5y6wy4$},set:function(a){this.$generated_KMF_ID_5y6wy4$=a}}}),Cell:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFContainer]},{content:{get:function(){return this.$content_k57d5r$},set:function(a){this.$content_k57d5r$=a}},rawContent:{get:function(){return this.$rawContent_145uk7$},set:function(a){this.$rawContent_145uk7$=a}},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_2pcwpq$},
set:function(a){this.$generated_KMF_ID_2pcwpq$=a}},feature:{get:function(){return this.$feature_iye9su$},set:function(a){this.$feature_iye9su$=a}},interpretation:{get:function(){return this.$interpretation_88197k$},set:function(a){this.$interpretation_88197k$=a}}}),Feature:b.createTrait(function(){return[a.pcm.AbstractFeature,a.org.kevoree.modeling.api.KMFContainer]},{cells:{get:function(){return this.$cells_3i7zyz$},set:function(a){this.$cells_3i7zyz$=a}}}),FeatureGroup:b.createTrait(function(){return[a.pcm.AbstractFeature,
a.org.kevoree.modeling.api.KMFContainer]},{subFeatures:{get:function(){return this.$subFeatures_6vj3lg$},set:function(a){this.$subFeatures_6vj3lg$=a}}}),Value:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFContainer]},{generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_spkxg7$},set:function(a){this.$generated_KMF_ID_spkxg7$=a}}}),IntegerValue:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{value:{get:function(){return this.$value_7il22e$},
set:function(a){this.$value_7il22e$=a}}}),StringValue:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{value:{get:function(){return this.$value_rk557z$},set:function(a){this.$value_rk557z$=a}}}),RealValue:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{value:{get:function(){return this.$value_dyjf2a$},set:function(a){this.$value_dyjf2a$=a}}}),BooleanValue:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},
{value:{get:function(){return this.$value_jh0h0g$},set:function(a){this.$value_jh0h0g$=a}}}),Multiple:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{subvalues:{get:function(){return this.$subvalues_dbh6m0$},set:function(a){this.$subvalues_dbh6m0$=a}}}),NotAvailable:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]}),Conditional:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{value:{get:function(){return this.$value_h9e2az$},
set:function(a){this.$value_h9e2az$=a}},condition:{get:function(){return this.$condition_4o6u81$},set:function(a){this.$condition_4o6u81$=a}}}),Partial:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{value:{get:function(){return this.$value_psaeeo$},set:function(a){this.$value_psaeeo$=a}}}),DateValue:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{value:{get:function(){return this.$value_hef84y$},set:function(a){this.$value_hef84y$=
a}}}),Version:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]}),Dimension:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]}),NotApplicable:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]}),Unit:b.createTrait(function(){return[a.pcm.Value,a.org.kevoree.modeling.api.KMFContainer]},{unit:{get:function(){return this.$unit_2pxu9y$},set:function(a){this.$unit_2pxu9y$=a}},value:{get:function(){return this.$value_dapghx$},
set:function(a){this.$value_dapghx$=a}}}),container:b.definePackage(function(){this.cleanCacheVisitor=b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function p(){p.baseInitializer.call(this)},{visit:function(a,b,h){},endVisitElem:function(a){a.path_cache=null}})},{RemoveFromContainerCommand:b.createClass(null,function(a,b,l,h){this.target=a;this.mutatorType=b;this.refName=l;this.element=h},{run:function(){this.target.isDeleted()||this.target.reflexiveMutator(this.mutatorType,
this.refName,this.element,!0,!0)}}),KMFContainerImpl:b.createTrait(function(){return[a.org.kevoree.modeling.api.util.InboundRefAware,a.org.kevoree.modeling.api.KMFContainer]},{internal_hashcode_c17phv$:{get:function(){return this.$internal_hashcode_c17phv$},set:function(a){this.$internal_hashcode_c17phv$=a}},hashCode:function(){null==this.internal_hashcode_c17phv$&&(this.internal_hashcode_c17phv$=Math.floor(1E7*Math.random())+(new Date).getTime());var a;return null!=(a=this.internal_hashcode_c17phv$)?
a:b.throwNPE()},internal_is_deleted:{get:function(){return this.$internal_is_deleted_pg7vpm$},set:function(a){this.$internal_is_deleted_pg7vpm$=a}},isDeleted:function(){return this.internal_is_deleted},internal_eContainer:{get:function(){return this.$internal_eContainer_mnh3ua$},set:function(a){this.$internal_eContainer_mnh3ua$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_et7q0t$},set:function(a){this.$internal_unsetCmd_et7q0t$=a}},eContainer:function(){return this.internal_eContainer},
internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_9qezvm$},set:function(a){this.$internal_containmentRefName_9qezvm$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_h5yq83$},set:function(a){this.$internal_readOnlyElem_h5yq83$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_n64g9c$},set:function(a){this.$internal_recursive_readOnlyElem_n64g9c$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_71rbrl$},
set:function(a){this.$internal_deleteInProgress_71rbrl$=a}},addInboundReference:function(b,p){this.internal_deleteInProgress||a.kotlin.getOrPut_ynyybx$(this.internal_inboundReferences,b,a.pcm.container.KMFContainerImpl.addInboundReference$f).add_za3rmp$(p)},removeInboundReference:function(a,b){if(!this.internal_deleteInProgress){var l=this.internal_inboundReferences.get_za3rmp$(a);null!=l&&(1<l.size()?l.remove_za3rmp$(b):this.internal_inboundReferences.remove_za3rmp$(a))}},advertiseInboundRefs:function(a,
p){for(var l=this.internal_inboundReferences.keySet().iterator();l.hasNext();){var h=l.next();if(!h.isDeleted())for(var q,v=(null!=(q=this.internal_inboundReferences.get_za3rmp$(h))?q:b.throwNPE()).iterator();v.hasNext();){var y=v.next();h.reflexiveMutator(a,y,p,!1,!0)}}},setRecursiveReadOnly:function(){if(!b.equals(this.internal_recursive_readOnlyElem,!0)){this.setInternalRecursiveReadOnly();var m=a.pcm.container.KMFContainerImpl.setRecursiveReadOnly$f();this.visit(m,!0,!0,!0);this.setInternalReadOnly()}},
setInternalReadOnly:function(){this.internal_readOnlyElem=!0},setInternalRecursiveReadOnly:function(){this.internal_recursive_readOnlyElem=!0},getRefInParent:function(){return this.internal_containmentRefName},isReadOnly:function(){return this.internal_readOnlyElem},isRecursiveReadOnly:function(){return this.internal_recursive_readOnlyElem},setEContainer:function(m,p,l){if(!this.internal_readOnlyElem&&!b.equals(this.eContainer(),m)){this.visit(a.pcm.container.cleanCacheVisitor,!0,!0,!1);var h=this.internal_unsetCmd;
this.internal_unsetCmd=null;null!=h&&h.run();this.internal_eContainer=m;this.internal_unsetCmd=p;this.internal_containmentRefName=l;this.path_cache=null}},select:function(m){return b.equals(this.path(),"/")&&m.startsWith("/")?a.org.kevoree.modeling.api.util.Selector.select(this,m.substring(1)):a.org.kevoree.modeling.api.util.Selector.select(this,m)},addModelElementListener:function(a){throw Error("Not activated, please add events option in KMF generation plugin");},removeModelElementListener:function(a){throw Error("Not activated, please add events option in KMF generation plugin");
},removeAllModelElementListeners:function(){throw Error("Not activated, please add events option in KMF generation plugin");},addModelTreeListener:function(a){throw Error("Not activated, please add events option in KMF generation plugin");},removeModelTreeListener:function(a){throw Error("Not activated, please add events option in KMF generation plugin");},removeAllModelTreeListeners:function(){throw Error("Not activated, please add events option in KMF generation plugin");},visit:function(a,b,l,
h){},visitAttributes:function(a){},internal_visit:function(a,p,l,h,q,v){if(null!=p){if(q&&l){var y=p.path(),w,u;if(null!=a.alreadyVisited&&(null!=(w=a.alreadyVisited)?w:b.throwNPE()).containsKey_za3rmp$(y))return;null==a.alreadyVisited&&(a.alreadyVisited=new b.PrimitiveHashMap);(null!=(u=a.alreadyVisited)?u:b.throwNPE()).put_wn2jw4$(y,p)}a.visit(p,v,this);a.visitStopped||(l&&(a.visitChildren||a.visitReferences)&&p.visit(a,l,h&&a.visitChildren,q&&a.visitReferences),a.visitChildren=!0,a.visitReferences=
!0)}},path_cache:{get:function(){return this.$path_cache_2tj5yw$},set:function(a){this.$path_cache_2tj5yw$=a}},key_cache:{get:function(){return this.$key_cache_ayc3v6$},set:function(a){this.$key_cache_ayc3v6$=a}},isRoot:function(){return this.is_root},is_root:{get:function(){return this.$is_root_zar0op$},set:function(a){this.$is_root_zar0op$=a}},path:function(){if(null!=this.path_cache){var a;return null!=(a=this.path_cache)?a:b.throwNPE()}a=this.eContainer();if(null!=a)if(a=a.path(),b.equals(a,"")){var p;
this.path_cache=(null!=(p=this.internal_containmentRefName)?p:b.throwNPE())+"["+this.internalGetKey()+"]"}else if(b.equals(a,"/")){var l;this.path_cache=a+(null!=(l=this.internal_containmentRefName)?l:b.throwNPE())+"["+this.internalGetKey()+"]"}else{var h;this.path_cache=a+"/"+(null!=(h=this.internal_containmentRefName)?h:b.throwNPE())+"["+this.internalGetKey()+"]"}else this.path_cache=this.is_root?"/":"";var q;return null!=(q=this.path_cache)?q:b.throwNPE()},modelEquals:function(m){if(null==m)return!1;
if(b.equals(this,m))return!0;if(!b.equals(m.metaClassName(),this.metaClassName()))return!1;var p=new b.PrimitiveHashMap,l=a.pcm.container.KMFContainerImpl.modelEquals$f(p);this.visitAttributes(l);m.visitAttributes(l);if(!p.isEmpty())return!1;l=a.pcm.container.KMFContainerImpl.modelEquals$f_0(p,"");this.visit(l,!1,!1,!0);m.visit(l,!1,!1,!0);return p.isEmpty()?!0:!1},deepModelEquals:function(m){if(!this.modelEquals(m))return!1;for(m=null!=m?m:b.throwNPE();null!=m.eContainer();){var p;m=null!=(p=m.eContainer())?
p:b.throwNPE()}p={v:!0};m=a.pcm.container.KMFContainerImpl.deepModelEquals$f(m,p);this.visit(m,!0,!0,!1);return p.v},findByPath:function(m){if(b.equals(m,this.path()))return this;if(b.equals(this.path(),"/")&&m.startsWith("/"))return this.findByPath(m.substring(1));var p=a.js.indexOf_960177$(m,"[");if(-1===p)return 0===m.length?this:null;var l="",h=2,q=m.substring(0,a.js.indexOf_960177$(m,"["));if(a.js.indexOf_960177$(m,"{")===p+1)l=m.substring(a.js.indexOf_960177$(m,"{")+1,a.js.indexOf_960177$(m,
"}")),h+=2;else{for(l=a.js.indexOf_960177$(m,"]");l+1<m.length&&"/"!==m.charAt(l+1);)if(l=a.js.indexOf_orzsrp$(m,"]",l+1),-1===l)return null;l=m.substring(a.js.indexOf_960177$(m,"[")+1,l)}m=m.substring(q.length+l.length+h,m.length);-1!==a.js.indexOf_960177$(m,"/")&&(m=m.substring(a.js.indexOf_960177$(m,"/")+1,m.length));q=this.findByID(q,l);return b.equals(m,"")||null==q?q:q.findByPath(m)},createTraces:function(m,p,l,h,q){var v=new b.ArrayList,y=new b.PrimitiveHashMap;if(q&&(q=a.pcm.container.KMFContainerImpl.createTraces$f(y),
this.visitAttributes(q),q=a.pcm.container.KMFContainerImpl.createTraces$f_0(y,p,v,this),null!=m&&m.visitAttributes(q),!p&&!l&&0!==a.kotlin.get_size(y)))for(q=y.keySet().iterator();q.hasNext();){var w=q.next();v.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(this.path(),w,null,null,null))}if(h&&(h=a.pcm.container.KMFContainerImpl.createTraces$f_1(y,""),this.visit(h,!1,!1,!0),h=a.pcm.container.KMFContainerImpl.createTraces$f_2(y,p,v,this),null!=m&&m.visit(h,!1,!1,!0),!p&&!l&&0!==a.kotlin.get_size(y)))for(m=
y.keySet().iterator();m.hasNext();)p=m.next(),p=b.splitString(p,"_"),v.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveTrace(this.path(),p[0],p[1]));return v},toTraces:function(m,p){var l=new b.ArrayList;if(m){var h=a.pcm.container.KMFContainerImpl.toTraces$f(l,this);this.visitAttributes(h)}p&&(h=a.pcm.container.KMFContainerImpl.toTraces$f_0(l,this),this.visit(h,!1,!0,!0));return l},visitNotContained:function(a){this.visit(a,!1,!1,!0)},visitContained:function(a){this.visit(a,!1,!0,!1)},
visitReferences:function(a){this.visit(a,!1,!0,!0)},deepVisitNotContained:function(a){this.visit(a,!0,!1,!0)},deepVisitContained:function(a){this.visit(a,!0,!0,!1)},deepVisitReferences:function(a){this.visit(a,!0,!0,!0)}},{addInboundReference$f:function(){return new b.PrimitiveHashSet},setRecursiveReadOnly$f:function(){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function p(){p.baseInitializer.call(this)},{visit:function(a,b,h){a.isRecursiveReadOnly()?this.noChildrenVisit():
(a.setInternalRecursiveReadOnly(),a.setInternalReadOnly())}})},modelEquals$f:function(m){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(a,l,h){m.containsKey_za3rmp$(l)?b.equals(m.get_za3rmp$(l),null!=a?a.toString():null)&&m.remove_za3rmp$(l):m.put_wn2jw4$(l,null!=a?a.toString():null)}})},modelEquals$f_0:function(m,p){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function h(){h.baseInitializer.call(this)},
{visit:function(a,b,v){a=b+"_"+a.path();m.containsKey_za3rmp$(a)?m.remove_za3rmp$(a):m.put_wn2jw4$(a,p)}})},deepModelEquals$f:function(m,p){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function h(){h.baseInitializer.call(this)},{visit:function(a,b,v){b=m.findByPath(a.path());a.modelEquals(b)||(p.v=!1,this.stopVisit())}})},createTraces$f:function(m){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(b,
l,h){m.put_wn2jw4$(l,a.org.kevoree.modeling.api.util.AttConverter.convFlatAtt(b))}})},createTraces$f_0:function(m,p,l,h){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(q,v,y){q=a.org.kevoree.modeling.api.util.AttConverter.convFlatAtt(q);b.equals(m.get_za3rmp$(v),q)?p&&l.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(h.path(),v,null,q,null)):p||l.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(h.path(),
v,null,q,null));m.remove_za3rmp$(v)}})},createTraces$f_1:function(m,p){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function h(){h.baseInitializer.call(this)},{visit:function(a,b,v){a=b+"_"+a.path();m.put_wn2jw4$(a,p)}})},createTraces$f_2:function(m,p,l,h){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function v(){v.baseInitializer.call(this)},{visit:function(b,y,w){w=y+"_"+b.path();null!=m.get_za3rmp$(w)?p&&l.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(h.path(),
y,b.path(),null)):p||l.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(h.path(),y,b.path(),null));m.remove_za3rmp$(w)}})},toTraces$f:function(m,p){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(b,h,q){m.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(p.path(),h,null,a.org.kevoree.modeling.api.util.AttConverter.convFlatAtt(b),null))}})},toTraces$f_0:function(m,p){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},
function h(){h.baseInitializer.call(this)},{visit:function(b,q,v){m.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(p.path(),q,b.path(),null))}})}})}),factory:b.definePackage(null,{PcmFactory:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFFactory]}),DefaultPcmFactory:b.createClass(function(){return[a.pcm.factory.PcmFactory]},null,{getVersion:function(){return"0.3-SNAPSHOT"},lookup:function(a){return null},createPCM:function(){return new a.pcm.impl.PCMImpl},createProduct:function(){return new a.pcm.impl.ProductImpl},
createAbstractFeature:function(){return new a.pcm.impl.AbstractFeatureImpl},createCell:function(){return new a.pcm.impl.CellImpl},createFeature:function(){return new a.pcm.impl.FeatureImpl},createFeatureGroup:function(){return new a.pcm.impl.FeatureGroupImpl},createValue:function(){return new a.pcm.impl.ValueImpl},createIntegerValue:function(){return new a.pcm.impl.IntegerValueImpl},createStringValue:function(){return new a.pcm.impl.StringValueImpl},createRealValue:function(){return new a.pcm.impl.RealValueImpl},
createBooleanValue:function(){return new a.pcm.impl.BooleanValueImpl},createMultiple:function(){return new a.pcm.impl.MultipleImpl},createNotAvailable:function(){return new a.pcm.impl.NotAvailableImpl},createConditional:function(){return new a.pcm.impl.ConditionalImpl},createPartial:function(){return new a.pcm.impl.PartialImpl},createDateValue:function(){return new a.pcm.impl.DateValueImpl},createVersion:function(){return new a.pcm.impl.VersionImpl},createDimension:function(){return new a.pcm.impl.DimensionImpl},
createNotApplicable:function(){return new a.pcm.impl.NotApplicableImpl},createUnit:function(){return new a.pcm.impl.UnitImpl},create:function(b){return b===a.pcm.util.Constants.pcm_PCM?this.createPCM():b===a.pcm.util.Constants.pcm_Product?this.createProduct():b===a.pcm.util.Constants.pcm_AbstractFeature?this.createAbstractFeature():b===a.pcm.util.Constants.pcm_Cell?this.createCell():b===a.pcm.util.Constants.pcm_Feature?this.createFeature():b===a.pcm.util.Constants.pcm_FeatureGroup?this.createFeatureGroup():
b===a.pcm.util.Constants.pcm_Value?this.createValue():b===a.pcm.util.Constants.pcm_IntegerValue?this.createIntegerValue():b===a.pcm.util.Constants.pcm_StringValue?this.createStringValue():b===a.pcm.util.Constants.pcm_RealValue?this.createRealValue():b===a.pcm.util.Constants.pcm_BooleanValue?this.createBooleanValue():b===a.pcm.util.Constants.pcm_Multiple?this.createMultiple():b===a.pcm.util.Constants.pcm_NotAvailable?this.createNotAvailable():b===a.pcm.util.Constants.pcm_Conditional?this.createConditional():
b===a.pcm.util.Constants.pcm_Partial?this.createPartial():b===a.pcm.util.Constants.pcm_DateValue?this.createDateValue():b===a.pcm.util.Constants.pcm_Version?this.createVersion():b===a.pcm.util.Constants.pcm_Dimension?this.createDimension():b===a.pcm.util.Constants.pcm_NotApplicable?this.createNotApplicable():b===a.pcm.util.Constants.pcm_Unit?this.createUnit():null},select:function(a){return new b.ArrayList},root:function(a){a.is_root=!0;a.path_cache="/"},createJSONSerializer:function(){return new a.org.kevoree.modeling.api.json.JSONModelSerializer},
createJSONLoader:function(){return new a.org.kevoree.modeling.api.json.JSONModelLoader(this)},createXMISerializer:function(){return new a.org.kevoree.modeling.api.xmi.XMIModelSerializer},createXMILoader:function(){return new a.org.kevoree.modeling.api.xmi.XMIModelLoader(this)},createModelCompare:function(){return new a.org.kevoree.modeling.api.compare.ModelCompare(this)},createModelCloner:function(){return new a.org.kevoree.modeling.api.ModelCloner(this)},createModelPruner:function(){return new a.org.kevoree.modeling.api.ModelPruner(this)}})}),
util:b.definePackage(function(){this.Constants=b.createObject(null,function(){this.UNKNOWN_MUTATION_TYPE_EXCEPTION="Unknown mutation type: ";this.READ_ONLY_EXCEPTION="This model is ReadOnly. Elements are not modifiable.";this.LIST_PARAMETER_OF_SET_IS_NULL_EXCEPTION="The list in parameter of the setter cannot be null. Use removeAll to empty a collection.";this.ELEMENT_HAS_NO_KEY_IN_COLLECTION="Cannot set the collection, because at least one element of it has no key!";this.EMPTY_KEY="Key empty : please set the attribute key before adding the object.";
this.KMFQL_CONTAINED="contained";this.STRING_DEFAULTVAL="";this.INT_DEFAULTVAL=0;this.BOOLEAN_DEFAULTVAL=!1;this.CHAR_DEFAULTVAL="a";this.BYTE_DEFAULTVAL=this.FLOAT_DEFAULTVAL=this.DOUBLE_DEFAULTVAL=this.LONG_DEFAULTVAL=this.SHORT_DEFAULTVAL=0;this.pcm_DateValue="pcm.DateValue";this.pcm_NotApplicable="pcm.NotApplicable";this.pcm_NotAvailable="pcm.NotAvailable";this.Ref_products="products";this.pcm_Unit="pcm.Unit";this.java_lang_Double="java.lang.Double";this.Ref_subvalues="subvalues";this.pcm_Value=
"pcm.Value";this.pcm_Multiple="pcm.Multiple";this.java_lang_Integer="java.lang.Integer";this.pcm_Partial="pcm.Partial";this.Ref_interpretation="interpretation";this.Att_name="name";this.Ref_condition="condition";this.pcm_PCM="pcm.PCM";this.pcm_BooleanValue="pcm.BooleanValue";this.java_lang_Boolean="java.lang.Boolean";this.Att_content="content";this.Ref_feature="feature";this.java_lang_String="java.lang.String";this.pcm_Version="pcm.Version";this.Att_unit="unit";this.Ref_subFeatures="subFeatures";
this.pcm_Cell="pcm.Cell";this.Ref_value="value";this.Att_rawContent="rawContent";this.pcm_Feature="pcm.Feature";this.pcm_FeatureGroup="pcm.FeatureGroup";this.pcm_Product="pcm.Product";this.pcm_RealValue="pcm.RealValue";this.Att_value="value";this.pcm_Conditional="pcm.Conditional";this.pcm_Dimension="pcm.Dimension";this.Ref_cells="cells";this.pcm_StringValue="pcm.StringValue";this.Att_generated_KMF_ID="generated_KMF_ID";this.pcm_AbstractFeature="pcm.AbstractFeature";this.pcm_IntegerValue="pcm.IntegerValue";
this.Ref_features="features"})},{}),impl:b.definePackage(null,{AbstractFeatureImpl:b.createClass(function(){return[a.pcm.AbstractFeature,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_qn6bcx$=this.$internal_containmentRefName_h0owpy$=this.$internal_eContainer_shvw3a$=null;this.$internal_recursive_readOnlyElem_6nmx1w$=this.$internal_readOnlyElem_bt6y0v$=!1;this.$internal_inboundReferences_9cp9u5$=new b.ComplexHashMap;this.$is_root_cpzoeb$=this.$internal_is_deleted_vamnym$=this.$internal_deleteInProgress_7vav2t$=
!1;this.$key_cache_bc7z02$=this.$path_cache_m1d8u4$=null;this.$name_qsmf1b$=a.pcm.util.Constants.STRING_DEFAULTVAL;this.$generated_KMF_ID_ja4s7u$=""+Math.random()+(new Date).getTime()},{internal_eContainer:{get:function(){return this.$internal_eContainer_shvw3a$},set:function(a){this.$internal_eContainer_shvw3a$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_h0owpy$},set:function(a){this.$internal_containmentRefName_h0owpy$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_qn6bcx$},
set:function(a){this.$internal_unsetCmd_qn6bcx$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_bt6y0v$},set:function(a){this.$internal_readOnlyElem_bt6y0v$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_6nmx1w$},set:function(a){this.$internal_recursive_readOnlyElem_6nmx1w$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_9cp9u5$},set:function(a){this.$internal_inboundReferences_9cp9u5$=
a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_7vav2t$},set:function(a){this.$internal_deleteInProgress_7vav2t$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_vamnym$},set:function(a){this.$internal_is_deleted_vamnym$=a}},is_root:{get:function(){return this.$is_root_cpzoeb$},set:function(a){this.$is_root_cpzoeb$=a}},path_cache:{get:function(){return this.$path_cache_m1d8u4$},set:function(a){this.$path_cache_m1d8u4$=a}},key_cache:{get:function(){return this.$key_cache_bc7z02$},
set:function(a){this.$key_cache_bc7z02$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withName:function(a){this.name=a;return this},name:{get:function(){return this.$name_qsmf1b$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
b.equals(m,this.name)||(this.$name_qsmf1b$=m)}},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_ja4s7u$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_ja4s7u$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,
null!=h?h:b.throwNPE(),p,!1,!1)}}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_name)this.name=l;else if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.name,
a.pcm.util.Constants.Att_name,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_AbstractFeature}}),NotApplicableImpl:b.createClass(function(){return[a.pcm.NotApplicable,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_uw87mr$=this.$internal_containmentRefName_weyf9k$=this.$internal_eContainer_5n0rzc$=null;this.$internal_recursive_readOnlyElem_4n8he2$=this.$internal_readOnlyElem_j874t$=
!1;this.$internal_inboundReferences_oiqbf9$=new b.ComplexHashMap;this.$is_root_4iywbl$=this.$internal_is_deleted_2ua040$=this.$internal_deleteInProgress_tvu1zd$=!1;this.$key_cache_2cjces$=this.$path_cache_gn4h9a$=null;this.$generated_KMF_ID_hilr9g$=""+Math.random()+(new Date).getTime()},{internal_eContainer:{get:function(){return this.$internal_eContainer_5n0rzc$},set:function(a){this.$internal_eContainer_5n0rzc$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_weyf9k$},
set:function(a){this.$internal_containmentRefName_weyf9k$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_uw87mr$},set:function(a){this.$internal_unsetCmd_uw87mr$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_j874t$},set:function(a){this.$internal_readOnlyElem_j874t$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_4n8he2$},set:function(a){this.$internal_recursive_readOnlyElem_4n8he2$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_oiqbf9$},
set:function(a){this.$internal_inboundReferences_oiqbf9$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_tvu1zd$},set:function(a){this.$internal_deleteInProgress_tvu1zd$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_2ua040$},set:function(a){this.$internal_is_deleted_2ua040$=a}},is_root:{get:function(){return this.$is_root_4iywbl$},set:function(a){this.$is_root_4iywbl$=a}},path_cache:{get:function(){return this.$path_cache_gn4h9a$},set:function(a){this.$path_cache_gn4h9a$=
a}},key_cache:{get:function(){return this.$key_cache_2cjces$},set:function(a){this.$key_cache_2cjces$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_hilr9g$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_hilr9g$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=
l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_NotApplicable}}),UnitImpl:b.createClass(function(){return[a.pcm.Unit,
a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_6k5g8t$=this.$internal_containmentRefName_kfw5r6$=this.$internal_eContainer_muntce$=null;this.$internal_recursive_readOnlyElem_guzosw$=this.$internal_readOnlyElem_8q17lp$=!1;this.$internal_inboundReferences_e1ng29$=new b.ComplexHashMap;this.$is_root_q51e7t$=this.$internal_is_deleted_k1x1h2$=this.$internal_deleteInProgress_ziie27$=!1;this.$key_cache_4le3rm$=this.$path_cache_irl8u0$=null;this.$generated_KMF_ID_d1zrva$=""+Math.random()+
(new Date).getTime();this.$unit_74832s$=a.pcm.util.Constants.STRING_DEFAULTVAL;this.$value_7jy1k1$=null},{internal_eContainer:{get:function(){return this.$internal_eContainer_muntce$},set:function(a){this.$internal_eContainer_muntce$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_kfw5r6$},set:function(a){this.$internal_containmentRefName_kfw5r6$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_6k5g8t$},set:function(a){this.$internal_unsetCmd_6k5g8t$=
a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_8q17lp$},set:function(a){this.$internal_readOnlyElem_8q17lp$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_guzosw$},set:function(a){this.$internal_recursive_readOnlyElem_guzosw$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_e1ng29$},set:function(a){this.$internal_inboundReferences_e1ng29$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_ziie27$},
set:function(a){this.$internal_deleteInProgress_ziie27$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_k1x1h2$},set:function(a){this.$internal_is_deleted_k1x1h2$=a}},is_root:{get:function(){return this.$is_root_q51e7t$},set:function(a){this.$is_root_q51e7t$=a}},path_cache:{get:function(){return this.$path_cache_irl8u0$},set:function(a){this.$path_cache_irl8u0$=a}},key_cache:{get:function(){return this.$key_cache_4le3rm$},set:function(a){this.$key_cache_4le3rm$=a}},"delete":function(){this.internal_deleteInProgress=
!0;if(null!=this.value){var m;(null!=(m=this.value)?m:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_value);this.value=null}this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var p;(null!=(p=this.internal_unsetCmd)?p:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_d1zrva$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_d1zrva$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},withUnit:function(a){this.unit=a;return this},unit:{get:function(){return this.$unit_74832s$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
b.equals(m,this.unit)||(this.$unit_74832s$=m)}},value:{get:function(){return this.$value_7jy1k1$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.internal_value(b,!0,!0)}},internal_value:function(m,p,l){if(!b.equals(this.$value_7jy1k1$,m)){if(null!=this.$value_7jy1k1$){var h;(null!=(h=this.$value_7jy1k1$)?h:b.throwNPE()).setEContainer(null,null,null)}null!=m&&(null!=m?m:b.throwNPE()).setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,
a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_value,null),a.pcm.util.Constants.Ref_value);if(null!=m)(null!=m?m:b.throwNPE()).addInboundReference(this,a.pcm.util.Constants.Ref_value);else if(null!=this.$value_7jy1k1$){var q;(null!=(q=this.$value_7jy1k1$)?q:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_value)}this.$value_7jy1k1$=m}},withValue:function(a){return this},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=
l;else if(p===a.pcm.util.Constants.Att_unit)this.unit=l;else if(p===a.pcm.util.Constants.Ref_value)if(b===a.org.kevoree.modeling.api.util.ActionType.object.SET)this.value=l;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.value=null;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.value=l;else{if(b!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+b);}else throw Error("Can not reflexively "+
b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(m,p){if(m===a.pcm.util.Constants.Ref_value){var l=this.value;return null!=l&&b.equals(l.internalGetKey(),p)?l:null}return null},visit:function(b,p,l,h){b.beginVisitElem(this);l&&(b.beginVisitRef(a.pcm.util.Constants.Ref_value,a.pcm.util.Constants.pcm_Value)&&this.internal_visit(b,this.value,p,l,h,a.pcm.util.Constants.Ref_value),b.endVisitRef(a.pcm.util.Constants.Ref_value));
b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.unit,a.pcm.util.Constants.Att_unit,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Unit}}),DateValueImpl:b.createClass(function(){return[a.pcm.DateValue,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_kqr5m6$=this.$internal_containmentRefName_ya9nhz$=this.$internal_eContainer_kgkxqf$=null;this.$internal_recursive_readOnlyElem_apx6n9$=
this.$internal_readOnlyElem_7qnvyq$=!1;this.$internal_inboundReferences_vc0sro$=new b.ComplexHashMap;this.$is_root_l6z366$=this.$internal_is_deleted_n9bplr$=this.$internal_deleteInProgress_mlgqsm$=!1;this.$key_cache_15kptv$=this.$path_cache_he64pf$=null;this.$generated_KMF_ID_rb2otx$=""+Math.random()+(new Date).getTime();this.$value_79fuc$=a.pcm.util.Constants.STRING_DEFAULTVAL},{internal_eContainer:{get:function(){return this.$internal_eContainer_kgkxqf$},set:function(a){this.$internal_eContainer_kgkxqf$=
a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_ya9nhz$},set:function(a){this.$internal_containmentRefName_ya9nhz$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_kqr5m6$},set:function(a){this.$internal_unsetCmd_kqr5m6$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_7qnvyq$},set:function(a){this.$internal_readOnlyElem_7qnvyq$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_apx6n9$},
set:function(a){this.$internal_recursive_readOnlyElem_apx6n9$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_vc0sro$},set:function(a){this.$internal_inboundReferences_vc0sro$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_mlgqsm$},set:function(a){this.$internal_deleteInProgress_mlgqsm$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_n9bplr$},set:function(a){this.$internal_is_deleted_n9bplr$=a}},
is_root:{get:function(){return this.$is_root_l6z366$},set:function(a){this.$is_root_l6z366$=a}},path_cache:{get:function(){return this.$path_cache_he64pf$},set:function(a){this.$path_cache_he64pf$=a}},key_cache:{get:function(){return this.$key_cache_15kptv$},set:function(a){this.$key_cache_15kptv$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;
(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_rb2otx$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_rb2otx$=m;null!=
l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},withValue:function(a){this.value=a;return this},value:{get:function(){return this.$value_79fuc$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,this.value)||(this.$value_79fuc$=m)}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Att_value)this.value=
l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.value,a.pcm.util.Constants.Att_value,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_DateValue}}),
PartialImpl:b.createClass(function(){return[a.pcm.Partial,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_ahlgac$=this.$internal_containmentRefName_p33ucn$=this.$internal_eContainer_bphl93$=null;this.$internal_recursive_readOnlyElem_mdcq7t$=this.$internal_readOnlyElem_7ut2fg$=!1;this.$internal_inboundReferences_qbpe4a$=new b.ComplexHashMap;this.$is_root_636wj4$=this.$internal_is_deleted_8wqtdr$=this.$internal_deleteInProgress_j2u6pk$=!1;this.$key_cache_oitcnv$=this.$path_cache_2qal69$=
null;this.$generated_KMF_ID_v9bx0t$=""+Math.random()+(new Date).getTime();this.$value_bxh2i$=null},{internal_eContainer:{get:function(){return this.$internal_eContainer_bphl93$},set:function(a){this.$internal_eContainer_bphl93$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_p33ucn$},set:function(a){this.$internal_containmentRefName_p33ucn$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_ahlgac$},set:function(a){this.$internal_unsetCmd_ahlgac$=
a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_7ut2fg$},set:function(a){this.$internal_readOnlyElem_7ut2fg$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_mdcq7t$},set:function(a){this.$internal_recursive_readOnlyElem_mdcq7t$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_qbpe4a$},set:function(a){this.$internal_inboundReferences_qbpe4a$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_j2u6pk$},
set:function(a){this.$internal_deleteInProgress_j2u6pk$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_8wqtdr$},set:function(a){this.$internal_is_deleted_8wqtdr$=a}},is_root:{get:function(){return this.$is_root_636wj4$},set:function(a){this.$is_root_636wj4$=a}},path_cache:{get:function(){return this.$path_cache_2qal69$},set:function(a){this.$path_cache_2qal69$=a}},key_cache:{get:function(){return this.$key_cache_oitcnv$},set:function(a){this.$key_cache_oitcnv$=a}},"delete":function(){this.internal_deleteInProgress=
!0;if(null!=this.value){var m;(null!=(m=this.value)?m:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_value);this.value=null}this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var p;(null!=(p=this.internal_unsetCmd)?p:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_v9bx0t$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_v9bx0t$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},value:{get:function(){return this.$value_bxh2i$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
this.internal_value(b,!0,!0)}},internal_value:function(m,p,l){if(!b.equals(this.$value_bxh2i$,m)){if(null!=this.$value_bxh2i$){var h;(null!=(h=this.$value_bxh2i$)?h:b.throwNPE()).setEContainer(null,null,null)}null!=m&&(null!=m?m:b.throwNPE()).setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_value,null),a.pcm.util.Constants.Ref_value);if(null!=m)(null!=m?m:b.throwNPE()).addInboundReference(this,a.pcm.util.Constants.Ref_value);
else if(null!=this.$value_bxh2i$){var q;(null!=(q=this.$value_bxh2i$)?q:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_value)}this.$value_bxh2i$=m}},withValue:function(a){return this},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Ref_value)if(b===a.org.kevoree.modeling.api.util.ActionType.object.SET)this.value=l;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.value=
null;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.value=l;else{if(b!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+b);}else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(m,p){if(m===a.pcm.util.Constants.Ref_value){var l=this.value;return null!=l&&b.equals(l.internalGetKey(),
p)?l:null}return null},visit:function(b,p,l,h){b.beginVisitElem(this);l&&(b.beginVisitRef(a.pcm.util.Constants.Ref_value,a.pcm.util.Constants.pcm_Value)&&this.internal_visit(b,this.value,p,l,h,a.pcm.util.Constants.Ref_value),b.endVisitRef(a.pcm.util.Constants.Ref_value));b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Partial}}),StringValueImpl:b.createClass(function(){return[a.pcm.StringValue,
a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_hto6ej$=this.$internal_containmentRefName_acalve$=this.$internal_eContainer_fnfad2$=null;this.$internal_recursive_readOnlyElem_gq2jdk$=this.$internal_readOnlyElem_w4dgrv$=!1;this.$internal_inboundReferences_drxedj$=new b.ComplexHashMap;this.$is_root_xgxxgv$=this.$internal_is_deleted_cuoihq$=this.$internal_deleteInProgress_rqtw15$=!1;this.$key_cache_vkj8ue$=this.$path_cache_y5o9hs$=null;this.$generated_KMF_ID_rl8hda$=""+Math.random()+
(new Date).getTime();this.$value_5jo9c9$=a.pcm.util.Constants.STRING_DEFAULTVAL},{internal_eContainer:{get:function(){return this.$internal_eContainer_fnfad2$},set:function(a){this.$internal_eContainer_fnfad2$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_acalve$},set:function(a){this.$internal_containmentRefName_acalve$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_hto6ej$},set:function(a){this.$internal_unsetCmd_hto6ej$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_w4dgrv$},
set:function(a){this.$internal_readOnlyElem_w4dgrv$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_gq2jdk$},set:function(a){this.$internal_recursive_readOnlyElem_gq2jdk$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_drxedj$},set:function(a){this.$internal_inboundReferences_drxedj$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_rqtw15$},set:function(a){this.$internal_deleteInProgress_rqtw15$=
a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_cuoihq$},set:function(a){this.$internal_is_deleted_cuoihq$=a}},is_root:{get:function(){return this.$is_root_xgxxgv$},set:function(a){this.$is_root_xgxxgv$=a}},path_cache:{get:function(){return this.$path_cache_y5o9hs$},set:function(a){this.$path_cache_y5o9hs$=a}},key_cache:{get:function(){return this.$key_cache_vkj8ue$},set:function(a){this.$key_cache_vkj8ue$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_rl8hda$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();
this.key_cache=this.path_cache=null;this.$generated_KMF_ID_rl8hda$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},withValue:function(a){this.value=a;return this},value:{get:function(){return this.$value_5jo9c9$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,this.value)||(this.$value_5jo9c9$=m)}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=
l;else if(p===a.pcm.util.Constants.Att_value)this.value=l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.value,a.pcm.util.Constants.Att_value,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},
metaClassName:function(){return a.pcm.util.Constants.pcm_StringValue}}),IntegerValueImpl:b.createClass(function(){return[a.pcm.IntegerValue,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_92tzte$=this.$internal_containmentRefName_o0v3fx$=this.$internal_eContainer_7502ub$=null;this.$internal_recursive_readOnlyElem_uw2hs1$=this.$internal_readOnlyElem_8suvo2$=!1;this.$internal_inboundReferences_x7qi0w$=new b.ComplexHashMap;this.$is_root_oieys6$=this.$internal_is_deleted_9xqupn$=
this.$internal_deleteInProgress_ddbwoy$=!1;this.$key_cache_oizixt$=this.$path_cache_2kz6lz$=null;this.$generated_KMF_ID_rb2v3b$=""+Math.random()+(new Date).getTime();this.$value_d0jllc$=a.pcm.util.Constants.INT_DEFAULTVAL},{internal_eContainer:{get:function(){return this.$internal_eContainer_7502ub$},set:function(a){this.$internal_eContainer_7502ub$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_o0v3fx$},set:function(a){this.$internal_containmentRefName_o0v3fx$=
a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_92tzte$},set:function(a){this.$internal_unsetCmd_92tzte$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_8suvo2$},set:function(a){this.$internal_readOnlyElem_8suvo2$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_uw2hs1$},set:function(a){this.$internal_recursive_readOnlyElem_uw2hs1$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_x7qi0w$},
set:function(a){this.$internal_inboundReferences_x7qi0w$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_ddbwoy$},set:function(a){this.$internal_deleteInProgress_ddbwoy$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_9xqupn$},set:function(a){this.$internal_is_deleted_9xqupn$=a}},is_root:{get:function(){return this.$is_root_oieys6$},set:function(a){this.$is_root_oieys6$=a}},path_cache:{get:function(){return this.$path_cache_2kz6lz$},set:function(a){this.$path_cache_2kz6lz$=
a}},key_cache:{get:function(){return this.$key_cache_oizixt$},set:function(a){this.$key_cache_oizixt$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_rb2v3b$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_rb2v3b$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},withValue:function(a){this.value=a;return this},value:{get:function(){return this.$value_d0jllc$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
b!==this.value&&(this.$value_d0jllc$=b)}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Att_value)this.value=l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.value,
a.pcm.util.Constants.Att_value,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_IntegerValue}}),ConditionalImpl:b.createClass(function(){return[a.pcm.Conditional,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_wwxysv$=this.$internal_containmentRefName_fbmlqs$=this.$internal_eContainer_hmg0tg$=null;this.$internal_recursive_readOnlyElem_orxvb6$=this.$internal_readOnlyElem_jk8p5d$=!1;this.$internal_inboundReferences_tnjzq9$=
new b.ComplexHashMap;this.$is_root_oz08d1$=this.$internal_is_deleted_kf6sos$=this.$internal_deleteInProgress_ymrsfx$=!1;this.$key_cache_tt450g$=this.$path_cache_hqkiay$=null;this.$generated_KMF_ID_5bxatk$=""+Math.random()+(new Date).getTime();this.$value_3p96z5$=this.$condition_gl1hif$=null},{internal_eContainer:{get:function(){return this.$internal_eContainer_hmg0tg$},set:function(a){this.$internal_eContainer_hmg0tg$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_fbmlqs$},
set:function(a){this.$internal_containmentRefName_fbmlqs$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_wwxysv$},set:function(a){this.$internal_unsetCmd_wwxysv$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_jk8p5d$},set:function(a){this.$internal_readOnlyElem_jk8p5d$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_orxvb6$},set:function(a){this.$internal_recursive_readOnlyElem_orxvb6$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_tnjzq9$},
set:function(a){this.$internal_inboundReferences_tnjzq9$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_ymrsfx$},set:function(a){this.$internal_deleteInProgress_ymrsfx$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_kf6sos$},set:function(a){this.$internal_is_deleted_kf6sos$=a}},is_root:{get:function(){return this.$is_root_oz08d1$},set:function(a){this.$is_root_oz08d1$=a}},path_cache:{get:function(){return this.$path_cache_hqkiay$},set:function(a){this.$path_cache_hqkiay$=
a}},key_cache:{get:function(){return this.$key_cache_tt450g$},set:function(a){this.$key_cache_tt450g$=a}},"delete":function(){this.internal_deleteInProgress=!0;if(null!=this.value){var m;(null!=(m=this.value)?m:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_value);this.value=null}if(null!=this.condition){var p;(null!=(p=this.condition)?p:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_condition);this.condition=null}this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var l;(null!=(l=this.internal_unsetCmd)?l:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_5bxatk$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();
this.key_cache=this.path_cache=null;this.$generated_KMF_ID_5bxatk$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},condition:{get:function(){return this.$condition_gl1hif$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.internal_condition(b,!0,!0)}},internal_condition:function(m,p,l){if(!b.equals(this.$condition_gl1hif$,m)){if(null!=this.$condition_gl1hif$){var h;(null!=
(h=this.$condition_gl1hif$)?h:b.throwNPE()).setEContainer(null,null,null)}null!=m&&(null!=m?m:b.throwNPE()).setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_condition,null),a.pcm.util.Constants.Ref_condition);if(null!=m)(null!=m?m:b.throwNPE()).addInboundReference(this,a.pcm.util.Constants.Ref_condition);else if(null!=this.$condition_gl1hif$){var q;(null!=(q=this.$condition_gl1hif$)?q:b.throwNPE()).removeInboundReference(this,
a.pcm.util.Constants.Ref_condition)}this.$condition_gl1hif$=m}},withCondition:function(a){return this},value:{get:function(){return this.$value_3p96z5$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.internal_value(b,!0,!0)}},internal_value:function(m,p,l){if(!b.equals(this.$value_3p96z5$,m)){if(null!=this.$value_3p96z5$){var h;(null!=(h=this.$value_3p96z5$)?h:b.throwNPE()).setEContainer(null,null,null)}null!=m&&(null!=m?m:b.throwNPE()).setEContainer(this,
new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_value,null),a.pcm.util.Constants.Ref_value);if(null!=m)(null!=m?m:b.throwNPE()).addInboundReference(this,a.pcm.util.Constants.Ref_value);else if(null!=this.$value_3p96z5$){var q;(null!=(q=this.$value_3p96z5$)?q:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_value)}this.$value_3p96z5$=m}},withValue:function(a){return this},reflexiveMutator:function(b,
p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Ref_value)if(b===a.org.kevoree.modeling.api.util.ActionType.object.SET)this.value=l;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.value=null;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.value=l;else{if(b!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+
b);}else if(p===a.pcm.util.Constants.Ref_condition)if(b===a.org.kevoree.modeling.api.util.ActionType.object.SET)this.condition=l;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.condition=null;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.condition=l;else{if(b!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+b);}else throw Error("Can not reflexively "+b+" for "+p+" on "+
this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(m,p){if(m===a.pcm.util.Constants.Ref_value){var l=this.value;return null!=l&&b.equals(l.internalGetKey(),p)?l:null}return m===a.pcm.util.Constants.Ref_condition?(l=this.condition,null!=l&&b.equals(l.internalGetKey(),p)?l:null):null},visit:function(b,p,l,h){b.beginVisitElem(this);l&&(b.beginVisitRef(a.pcm.util.Constants.Ref_value,a.pcm.util.Constants.pcm_Value)&&this.internal_visit(b,
this.value,p,l,h,a.pcm.util.Constants.Ref_value),b.endVisitRef(a.pcm.util.Constants.Ref_value),b.beginVisitRef(a.pcm.util.Constants.Ref_condition,a.pcm.util.Constants.pcm_Value)&&this.internal_visit(b,this.condition,p,l,h,a.pcm.util.Constants.Ref_condition),b.endVisitRef(a.pcm.util.Constants.Ref_condition));b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Conditional}}),
NotAvailableImpl:b.createClass(function(){return[a.pcm.NotAvailable,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_l37d57$=this.$internal_containmentRefName_nh4az4$=this.$internal_eContainer_hpco3k$=null;this.$internal_recursive_readOnlyElem_e9iuu6$=this.$internal_readOnlyElem_czva7p$=!1;this.$internal_inboundReferences_x73kl9$=new b.ComplexHashMap;this.$is_root_k9elc7$=this.$internal_is_deleted_ki3fyw$=this.$internal_deleteInProgress_mjaujj$=!1;this.$key_cache_sfxef0$=this.$path_cache_axqn7e$=
null;this.$generated_KMF_ID_qd5zto$=""+Math.random()+(new Date).getTime()},{internal_eContainer:{get:function(){return this.$internal_eContainer_hpco3k$},set:function(a){this.$internal_eContainer_hpco3k$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_nh4az4$},set:function(a){this.$internal_containmentRefName_nh4az4$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_l37d57$},set:function(a){this.$internal_unsetCmd_l37d57$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_czva7p$},
set:function(a){this.$internal_readOnlyElem_czva7p$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_e9iuu6$},set:function(a){this.$internal_recursive_readOnlyElem_e9iuu6$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_x73kl9$},set:function(a){this.$internal_inboundReferences_x73kl9$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_mjaujj$},set:function(a){this.$internal_deleteInProgress_mjaujj$=
a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_ki3fyw$},set:function(a){this.$internal_is_deleted_ki3fyw$=a}},is_root:{get:function(){return this.$is_root_k9elc7$},set:function(a){this.$is_root_k9elc7$=a}},path_cache:{get:function(){return this.$path_cache_axqn7e$},set:function(a){this.$path_cache_axqn7e$=a}},key_cache:{get:function(){return this.$key_cache_sfxef0$},set:function(a){this.$key_cache_sfxef0$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_qd5zto$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();
this.key_cache=this.path_cache=null;this.$generated_KMF_ID_qd5zto$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,
b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_NotAvailable}}),DimensionImpl:b.createClass(function(){return[a.pcm.Dimension,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_bdlxjj$=this.$internal_containmentRefName_w8gz78$=this.$internal_eContainer_9i1mik$=null;this.$internal_recursive_readOnlyElem_2i9h26$=
this.$internal_readOnlyElem_i30fjl$=!1;this.$internal_inboundReferences_m8gapt$=new b.ComplexHashMap;this.$is_root_ft0xfv$=this.$internal_is_deleted_6paun8$=this.$internal_deleteInProgress_drrnkt$=!1;this.$key_cache_91xqtc$=this.$path_cache_lv28ne$=null;this.$generated_KMF_ID_caypnc$=""+Math.random()+(new Date).getTime()},{internal_eContainer:{get:function(){return this.$internal_eContainer_9i1mik$},set:function(a){this.$internal_eContainer_9i1mik$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_w8gz78$},
set:function(a){this.$internal_containmentRefName_w8gz78$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_bdlxjj$},set:function(a){this.$internal_unsetCmd_bdlxjj$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_i30fjl$},set:function(a){this.$internal_readOnlyElem_i30fjl$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_2i9h26$},set:function(a){this.$internal_recursive_readOnlyElem_2i9h26$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_m8gapt$},
set:function(a){this.$internal_inboundReferences_m8gapt$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_drrnkt$},set:function(a){this.$internal_deleteInProgress_drrnkt$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_6paun8$},set:function(a){this.$internal_is_deleted_6paun8$=a}},is_root:{get:function(){return this.$is_root_ft0xfv$},set:function(a){this.$is_root_ft0xfv$=a}},path_cache:{get:function(){return this.$path_cache_lv28ne$},set:function(a){this.$path_cache_lv28ne$=
a}},key_cache:{get:function(){return this.$key_cache_91xqtc$},set:function(a){this.$key_cache_91xqtc$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_caypnc$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_caypnc$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=
l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Dimension}}),ValueImpl:b.createClass(function(){return[a.pcm.Value,
a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_dikddo$=this.$internal_containmentRefName_r5wxm1$=this.$internal_eContainer_50nb21$=null;this.$internal_recursive_readOnlyElem_c6nt93$=this.$internal_readOnlyElem_cugzr8$=!1;this.$internal_inboundReferences_2t0r3e$=new b.ComplexHashMap;this.$is_root_z69g74$=this.$internal_is_deleted_7te2xd$=this.$internal_deleteInProgress_c8o9p4$=!1;this.$key_cache_sdljjp$=this.$path_cache_8xj28x$=null;this.$generated_KMF_ID_iaa5q5$=""+Math.random()+
(new Date).getTime()},{internal_eContainer:{get:function(){return this.$internal_eContainer_50nb21$},set:function(a){this.$internal_eContainer_50nb21$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_r5wxm1$},set:function(a){this.$internal_containmentRefName_r5wxm1$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_dikddo$},set:function(a){this.$internal_unsetCmd_dikddo$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_cugzr8$},
set:function(a){this.$internal_readOnlyElem_cugzr8$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_c6nt93$},set:function(a){this.$internal_recursive_readOnlyElem_c6nt93$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_2t0r3e$},set:function(a){this.$internal_inboundReferences_2t0r3e$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_c8o9p4$},set:function(a){this.$internal_deleteInProgress_c8o9p4$=
a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_7te2xd$},set:function(a){this.$internal_is_deleted_7te2xd$=a}},is_root:{get:function(){return this.$is_root_z69g74$},set:function(a){this.$is_root_z69g74$=a}},path_cache:{get:function(){return this.$path_cache_8xj28x$},set:function(a){this.$path_cache_8xj28x$=a}},key_cache:{get:function(){return this.$key_cache_sdljjp$},set:function(a){this.$key_cache_sdljjp$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_iaa5q5$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();
this.key_cache=this.path_cache=null;this.$generated_KMF_ID_iaa5q5$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,
b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Value}}),FeatureGroupImpl:b.createClass(function(){return[a.pcm.FeatureGroup,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_ynq74o$=this.$internal_containmentRefName_7h673x$=this.$internal_eContainer_b4mzg3$=null;this.$internal_recursive_readOnlyElem_jkdg6j$=
this.$internal_readOnlyElem_jipf3c$=!1;this.$internal_inboundReferences_ki23iu$=new b.ComplexHashMap;this.$is_root_fptf58$=this.$internal_is_deleted_8bw7kr$=this.$internal_deleteInProgress_5xrejw$=!1;this.$key_cache_ps8uif$=this.$path_cache_yn29u5$=null;this.$name_2cpgtm$=a.pcm.util.Constants.STRING_DEFAULTVAL;this.$generated_KMF_ID_t3ev1r$=""+Math.random()+(new Date).getTime();this._subFeatures=new a.java.util.concurrent.ConcurrentHashMap},{internal_eContainer:{get:function(){return this.$internal_eContainer_b4mzg3$},
set:function(a){this.$internal_eContainer_b4mzg3$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_7h673x$},set:function(a){this.$internal_containmentRefName_7h673x$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_ynq74o$},set:function(a){this.$internal_unsetCmd_ynq74o$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_jipf3c$},set:function(a){this.$internal_readOnlyElem_jipf3c$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_jkdg6j$},
set:function(a){this.$internal_recursive_readOnlyElem_jkdg6j$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_ki23iu$},set:function(a){this.$internal_inboundReferences_ki23iu$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_5xrejw$},set:function(a){this.$internal_deleteInProgress_5xrejw$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_8bw7kr$},set:function(a){this.$internal_is_deleted_8bw7kr$=a}},
is_root:{get:function(){return this.$is_root_fptf58$},set:function(a){this.$is_root_fptf58$=a}},path_cache:{get:function(){return this.$path_cache_yn29u5$},set:function(a){this.$path_cache_yn29u5$=a}},key_cache:{get:function(){return this.$key_cache_ps8uif$},set:function(a){this.$key_cache_ps8uif$=a}},"delete":function(){this.internal_deleteInProgress=!0;for(var m=this.subFeatures.iterator();m.hasNext();)m.next()["delete"]();this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var p;(null!=(p=this.internal_unsetCmd)?p:b.throwNPE()).run()}this.internal_is_deleted=!0},withName:function(a){this.name=a;return this},name:{get:function(){return this.$name_2cpgtm$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,this.name)||(this.$name_2cpgtm$=m)}},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_t3ev1r$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_t3ev1r$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},subFeatures:{get:function(){return a.kotlin.toList_h3panj$(this._subFeatures.values())},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
if(null==m)throw new b.IllegalArgumentException(a.pcm.util.Constants.LIST_PARAMETER_OF_SET_IS_NULL_EXCEPTION);this.internal_subFeatures(m,!0,!0)}},internal_subFeatures:function(m,p,l){if(!b.equals(this._subFeatures.values(),m))for(this._subFeatures.clear(),m=m.iterator();m.hasNext();){p=m.next();l=p.internalGetKey();if(null==l)throw Error(a.pcm.util.Constants.ELEMENT_HAS_NO_KEY_IN_COLLECTION);this._subFeatures.put_wn2jw4$(null!=l?l:b.throwNPE(),p);p.addInboundReference(this,a.pcm.util.Constants.Ref_subFeatures);
p.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_subFeatures,p),a.pcm.util.Constants.Ref_subFeatures)}},doAddSubFeatures:function(m){var p=m.internalGetKey();if(null==p||b.equals(p,""))throw Error(a.pcm.util.Constants.EMPTY_KEY);this._subFeatures.containsKey_za3rmp$(p)||(this._subFeatures.put_wn2jw4$(p,m),m.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
a.pcm.util.Constants.Ref_subFeatures,m),a.pcm.util.Constants.Ref_subFeatures),m.addInboundReference(this,a.pcm.util.Constants.Ref_subFeatures))},addSubFeatures:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.doAddSubFeatures(b);return this},addAllSubFeatures:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);for(b=b.iterator();b.hasNext();){var p=b.next();this.doAddSubFeatures(p)}return this},removeSubFeatures:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
0!==this._subFeatures.size()&&this._subFeatures.containsKey_za3rmp$(b.internalGetKey())&&(this._subFeatures.remove_za3rmp$(b.internalGetKey()),b.removeInboundReference(this,a.pcm.util.Constants.Ref_subFeatures),b.setEContainer(null,null,null));return this},removeAllSubFeatures:function(){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);for(var b=this.subFeatures.iterator();b.hasNext();){var p=b.next();p.removeInboundReference(this,a.pcm.util.Constants.Ref_subFeatures);p.setEContainer(null,
null,null)}this._subFeatures.clear();return this},reflexiveMutator:function(m,p,l,h,q){if(p===a.pcm.util.Constants.Att_name)this.name=l;else if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Ref_subFeatures)if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.addSubFeatures(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL)this.addAllSubFeatures(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.removeSubFeatures(null!=
l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL)this.removeAllSubFeatures();else if(m===a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX){if(0!==this._subFeatures.size()&&this._subFeatures.containsKey_za3rmp$(l)){m=this._subFeatures.get_za3rmp$(l);p=(null!=m?m:b.throwNPE()).internalGetKey();if(null==p)throw Error("Key newed to null "+m);this._subFeatures.remove_za3rmp$(l);this._subFeatures.put_wn2jw4$(p,m)}}else throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+
m);else throw Error("Can not reflexively "+m+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findSubFeaturesByID:function(a){return this._subFeatures.get_za3rmp$(a)},findByID:function(b,p){return b===a.pcm.util.Constants.Ref_subFeatures?this.findSubFeaturesByID(p):null},visit:function(b,p,l,h){b.beginVisitElem(this);if(l){if(b.beginVisitRef(a.pcm.util.Constants.Ref_subFeatures,a.pcm.util.Constants.pcm_AbstractFeature))for(var q=
this._subFeatures.keySet().iterator();q.hasNext();){var v=q.next();this.internal_visit(b,this._subFeatures.get_za3rmp$(v),p,l,h,a.pcm.util.Constants.Ref_subFeatures)}b.endVisitRef(a.pcm.util.Constants.Ref_subFeatures)}b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.name,a.pcm.util.Constants.Att_name,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_FeatureGroup}}),FeatureImpl:b.createClass(function(){return[a.pcm.Feature,
a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_6xfh1d$=this.$internal_containmentRefName_b2gs7w$=this.$internal_eContainer_dhdrqs$=null;this.$internal_recursive_readOnlyElem_ye6gmm$=this.$internal_readOnlyElem_kz1upt$=!1;this.$internal_inboundReferences_65lh3j$=new b.ComplexHashMap;this.$is_root_k7ha6d$=this.$internal_is_deleted_ga4jm4$=this.$internal_deleteInProgress_a22qqb$=!1;this.$key_cache_8ecvf4$=this.$path_cache_5cp1vq$=null;this.$name_rffgkj$=a.pcm.util.Constants.STRING_DEFAULTVAL;
this.$generated_KMF_ID_9f7trc$=""+Math.random()+(new Date).getTime();this._cells=new a.java.util.concurrent.ConcurrentHashMap},{internal_eContainer:{get:function(){return this.$internal_eContainer_dhdrqs$},set:function(a){this.$internal_eContainer_dhdrqs$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_b2gs7w$},set:function(a){this.$internal_containmentRefName_b2gs7w$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_6xfh1d$},set:function(a){this.$internal_unsetCmd_6xfh1d$=
a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_kz1upt$},set:function(a){this.$internal_readOnlyElem_kz1upt$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_ye6gmm$},set:function(a){this.$internal_recursive_readOnlyElem_ye6gmm$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_65lh3j$},set:function(a){this.$internal_inboundReferences_65lh3j$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_a22qqb$},
set:function(a){this.$internal_deleteInProgress_a22qqb$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_ga4jm4$},set:function(a){this.$internal_is_deleted_ga4jm4$=a}},is_root:{get:function(){return this.$is_root_k7ha6d$},set:function(a){this.$is_root_k7ha6d$=a}},path_cache:{get:function(){return this.$path_cache_5cp1vq$},set:function(a){this.$path_cache_5cp1vq$=a}},key_cache:{get:function(){return this.$key_cache_8ecvf4$},set:function(a){this.$key_cache_8ecvf4$=a}},"delete":function(){this.internal_deleteInProgress=
!0;this.removeAllCells();this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withName:function(a){this.name=a;return this},name:{get:function(){return this.$name_rffgkj$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,this.name)||(this.$name_rffgkj$=
m)}},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_9f7trc$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_9f7trc$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,
null!=h?h:b.throwNPE(),p,!1,!1)}}},cells:{get:function(){return a.kotlin.toList_h3panj$(this._cells.values())},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(null==m)throw new b.IllegalArgumentException(a.pcm.util.Constants.LIST_PARAMETER_OF_SET_IS_NULL_EXCEPTION);this.internal_cells(m,!0,!0)}},internal_cells:function(m,p,l){if(!b.equals(this._cells.values(),m))for(this.internal_removeAllCells(!0,!1),m=m.iterator();m.hasNext();){p=m.next();var h=p.internalGetKey();
if(null==h)throw Error(a.pcm.util.Constants.ELEMENT_HAS_NO_KEY_IN_COLLECTION);this._cells.put_wn2jw4$(null!=h?h:b.throwNPE(),p);p.addInboundReference(this,a.pcm.util.Constants.Ref_cells);p.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_feature,this,!1,l)}},doAddCells:function(m){var p=m.internalGetKey();if(null==p||b.equals(p,""))throw Error(a.pcm.util.Constants.EMPTY_KEY);this._cells.containsKey_za3rmp$(p)||(this._cells.put_wn2jw4$(p,m),m.addInboundReference(this,
a.pcm.util.Constants.Ref_cells))},addCells:function(a){this.internal_addCells(a,!0,!0);return this},addAllCells:function(a){this.internal_addAllCells(a,!0,!0);return this},internal_addCells:function(b,p,l){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.doAddCells(b);p&&b.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_feature,this,!1,l)},internal_addAllCells:function(b,p,l){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
if(p)for(b=b.iterator();b.hasNext();)p=b.next(),this.doAddCells(p),p.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_feature,this,!1,l);else for(l=b.iterator();l.hasNext();)b=l.next(),this.doAddCells(b)},removeCells:function(a){this.internal_removeCells(a,!0,!0);return this},removeAllCells:function(){this.internal_removeAllCells(!0,!0);return this},internal_removeCells:function(b,p,l){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
0!==this._cells.size()&&this._cells.containsKey_za3rmp$(b.internalGetKey())&&(b.path(),this._cells.remove_za3rmp$(b.internalGetKey()),b.removeInboundReference(this,a.pcm.util.Constants.Ref_cells),p&&b.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_feature,null,!1,l))},internal_removeAllCells:function(b,p){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);var l=this.cells;if(b)for(l=l.iterator();l.hasNext();){var h=l.next();
h.removeInboundReference(this,a.pcm.util.Constants.Ref_cells);h.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_feature,null,!1,p)}this._cells.clear()},reflexiveMutator:function(m,p,l,h,q){if(p===a.pcm.util.Constants.Att_name)this.name=l;else if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Ref_cells)if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.internal_addCells(null!=l?l:
b.throwNPE(),h,q);else if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL)this.internal_addAllCells(null!=l?l:b.throwNPE(),h,q);else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.internal_removeCells(null!=l?l:b.throwNPE(),h,q);else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL)this.internal_removeAllCells(h,q);else if(m===a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX){if(0!==this._cells.size()&&this._cells.containsKey_za3rmp$(l)){m=
this._cells.get_za3rmp$(l);p=(null!=m?m:b.throwNPE()).internalGetKey();if(null==p)throw Error("Key newed to null "+m);this._cells.remove_za3rmp$(l);this._cells.put_wn2jw4$(p,m)}}else throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+m);else throw Error("Can not reflexively "+m+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findCellsByID:function(a){return this._cells.get_za3rmp$(a)},findByID:function(b,
p){return b===a.pcm.util.Constants.Ref_cells?this.findCellsByID(p):null},visit:function(b,p,l,h){b.beginVisitElem(this);if(h){if(b.beginVisitRef(a.pcm.util.Constants.Ref_cells,a.pcm.util.Constants.pcm_Cell))for(var q=this._cells.keySet().iterator();q.hasNext();){var v=q.next();this.internal_visit(b,this._cells.get_za3rmp$(v),p,l,h,a.pcm.util.Constants.Ref_cells)}b.endVisitRef(a.pcm.util.Constants.Ref_cells)}b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.name,a.pcm.util.Constants.Att_name,
this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Feature}}),CellImpl:b.createClass(function(){return[a.pcm.Cell,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_goudjz$=this.$internal_containmentRefName_ku82f8$=this.$internal_eContainer_itq4vg$=null;this.$internal_recursive_readOnlyElem_6vvxji$=this.$internal_readOnlyElem_t03kpt$=!1;this.$internal_inboundReferences_piju7j$=new b.ComplexHashMap;
this.$is_root_ds72hn$=this.$internal_is_deleted_g0zd04$=this.$internal_deleteInProgress_juib5f$=!1;this.$key_cache_h93ze8$=this.$path_cache_ezsujq$=null;this.$rawContent_qvadur$=this.$content_whd7zt$=a.pcm.util.Constants.STRING_DEFAULTVAL;this.$generated_KMF_ID_ln2zpk$=""+Math.random()+(new Date).getTime();this.$interpretation_ddutmu$=this.$feature_6m8eys$=null},{internal_eContainer:{get:function(){return this.$internal_eContainer_itq4vg$},set:function(a){this.$internal_eContainer_itq4vg$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_ku82f8$},
set:function(a){this.$internal_containmentRefName_ku82f8$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_goudjz$},set:function(a){this.$internal_unsetCmd_goudjz$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_t03kpt$},set:function(a){this.$internal_readOnlyElem_t03kpt$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_6vvxji$},set:function(a){this.$internal_recursive_readOnlyElem_6vvxji$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_piju7j$},
set:function(a){this.$internal_inboundReferences_piju7j$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_juib5f$},set:function(a){this.$internal_deleteInProgress_juib5f$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_g0zd04$},set:function(a){this.$internal_is_deleted_g0zd04$=a}},is_root:{get:function(){return this.$is_root_ds72hn$},set:function(a){this.$is_root_ds72hn$=a}},path_cache:{get:function(){return this.$path_cache_ezsujq$},set:function(a){this.$path_cache_ezsujq$=
a}},key_cache:{get:function(){return this.$key_cache_h93ze8$},set:function(a){this.$key_cache_h93ze8$=a}},"delete":function(){this.internal_deleteInProgress=!0;if(null!=this.feature){var m;(null!=(m=this.feature)?m:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_feature);this.feature=null}if(null!=this.interpretation){var p;(null!=(p=this.interpretation)?p:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_interpretation);this.interpretation=null}this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var l;(null!=(l=this.internal_unsetCmd)?l:b.throwNPE()).run()}this.internal_is_deleted=!0},withContent:function(a){this.content=a;return this},content:{get:function(){return this.$content_whd7zt$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,this.content)||(this.$content_whd7zt$=m)}},withRawContent:function(a){this.rawContent=a;return this},rawContent:{get:function(){return this.$rawContent_qvadur$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,this.rawContent)||(this.$rawContent_qvadur$=m)}},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_ln2zpk$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=
this.path_cache=null;this.$generated_KMF_ID_ln2zpk$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},feature:{get:function(){return this.$feature_6m8eys$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.internal_feature(b,!0,!0)}},internal_feature:function(m,p,l){if(!b.equals(this.$feature_6m8eys$,m)){if(p){if(null!=this.$feature_6m8eys$){var h;(null!=(h=this.$feature_6m8eys$)?
h:b.throwNPE()).reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_cells,this,!1,l)}null!=m&&m.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,a.pcm.util.Constants.Ref_cells,this,!1,l)}if(null!=m)(null!=m?m:b.throwNPE()).addInboundReference(this,a.pcm.util.Constants.Ref_feature);else if(null!=this.$feature_6m8eys$){var q;(null!=(q=this.$feature_6m8eys$)?q:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_feature)}this.$feature_6m8eys$=
m}},withFeature:function(a){return this},interpretation:{get:function(){return this.$interpretation_ddutmu$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.internal_interpretation(b,!0,!0)}},internal_interpretation:function(m,p,l){if(!b.equals(this.$interpretation_ddutmu$,m)){if(null!=this.$interpretation_ddutmu$){var h;(null!=(h=this.$interpretation_ddutmu$)?h:b.throwNPE()).setEContainer(null,null,null)}null!=m&&(null!=m?m:b.throwNPE()).setEContainer(this,
new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.SET,a.pcm.util.Constants.Ref_interpretation,null),a.pcm.util.Constants.Ref_interpretation);if(null!=m)(null!=m?m:b.throwNPE()).addInboundReference(this,a.pcm.util.Constants.Ref_interpretation);else if(null!=this.$interpretation_ddutmu$){var q;(null!=(q=this.$interpretation_ddutmu$)?q:b.throwNPE()).removeInboundReference(this,a.pcm.util.Constants.Ref_interpretation)}this.$interpretation_ddutmu$=m}},
withInterpretation:function(a){return this},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_content)this.content=l;else if(p===a.pcm.util.Constants.Att_rawContent)this.rawContent=l;else if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Ref_feature)if(b===a.org.kevoree.modeling.api.util.ActionType.object.SET)this.internal_feature(l,h,q);else if(b===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.internal_feature(null,
h,q);else if(b===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.internal_feature(l,h,q);else{if(b!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+b);}else if(p===a.pcm.util.Constants.Ref_interpretation)if(b===a.org.kevoree.modeling.api.util.ActionType.object.SET)this.interpretation=l;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.interpretation=null;else if(b===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.interpretation=
l;else{if(b!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+b);}else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(m,p){if(m===a.pcm.util.Constants.Ref_feature){var l=this.feature;return null!=l&&b.equals(l.internalGetKey(),p)?l:null}return m===a.pcm.util.Constants.Ref_interpretation?
(l=this.interpretation,null!=l&&b.equals(l.internalGetKey(),p)?l:null):null},visit:function(b,p,l,h){b.beginVisitElem(this);l&&(b.beginVisitRef(a.pcm.util.Constants.Ref_interpretation,a.pcm.util.Constants.pcm_Value)&&this.internal_visit(b,this.interpretation,p,l,h,a.pcm.util.Constants.Ref_interpretation),b.endVisitRef(a.pcm.util.Constants.Ref_interpretation));h&&(b.beginVisitRef(a.pcm.util.Constants.Ref_feature,a.pcm.util.Constants.pcm_Feature)&&this.internal_visit(b,this.feature,p,l,h,a.pcm.util.Constants.Ref_feature),
b.endVisitRef(a.pcm.util.Constants.Ref_feature));b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.content,a.pcm.util.Constants.Att_content,this);b.visit(this.rawContent,a.pcm.util.Constants.Att_rawContent,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Cell}}),ProductImpl:b.createClass(function(){return[a.pcm.Product,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_wmyax2$=
this.$internal_containmentRefName_vvecdn$=this.$internal_eContainer_z1voor$=null;this.$internal_recursive_readOnlyElem_yt8sex$=this.$internal_readOnlyElem_xtpgmy$=!1;this.$internal_inboundReferences_hnwdnc$=new b.ComplexHashMap;this.$is_root_p6goce$=this.$internal_is_deleted_x6hlf1$=this.$internal_deleteInProgress_twsw4a$=!1;this.$key_cache_r6mdzd$=this.$path_cache_8qlhr5$=null;this.$name_1m7wck$=a.pcm.util.Constants.STRING_DEFAULTVAL;this.$generated_KMF_ID_vbjwe9$=""+Math.random()+(new Date).getTime();
this._cells=new a.java.util.concurrent.ConcurrentHashMap},{internal_eContainer:{get:function(){return this.$internal_eContainer_z1voor$},set:function(a){this.$internal_eContainer_z1voor$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_vvecdn$},set:function(a){this.$internal_containmentRefName_vvecdn$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_wmyax2$},set:function(a){this.$internal_unsetCmd_wmyax2$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_xtpgmy$},
set:function(a){this.$internal_readOnlyElem_xtpgmy$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_yt8sex$},set:function(a){this.$internal_recursive_readOnlyElem_yt8sex$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_hnwdnc$},set:function(a){this.$internal_inboundReferences_hnwdnc$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_twsw4a$},set:function(a){this.$internal_deleteInProgress_twsw4a$=
a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_x6hlf1$},set:function(a){this.$internal_is_deleted_x6hlf1$=a}},is_root:{get:function(){return this.$is_root_p6goce$},set:function(a){this.$is_root_p6goce$=a}},path_cache:{get:function(){return this.$path_cache_8qlhr5$},set:function(a){this.$path_cache_8qlhr5$=a}},key_cache:{get:function(){return this.$key_cache_r6mdzd$},set:function(a){this.$key_cache_r6mdzd$=a}},"delete":function(){this.internal_deleteInProgress=!0;for(var m=
this.cells.iterator();m.hasNext();)m.next()["delete"]();this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var p;(null!=(p=this.internal_unsetCmd)?p:b.throwNPE()).run()}this.internal_is_deleted=!0},withName:function(a){this.name=a;return this},name:{get:function(){return this.$name_1m7wck$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,
this.name)||(this.$name_1m7wck$=m)}},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_vbjwe9$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_vbjwe9$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,
null!=h?h:b.throwNPE(),p,!1,!1)}}},cells:{get:function(){return a.kotlin.toList_h3panj$(this._cells.values())},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(null==m)throw new b.IllegalArgumentException(a.pcm.util.Constants.LIST_PARAMETER_OF_SET_IS_NULL_EXCEPTION);this.internal_cells(m,!0,!0)}},internal_cells:function(m,p,l){if(!b.equals(this._cells.values(),m))for(this._cells.clear(),m=m.iterator();m.hasNext();){p=m.next();l=p.internalGetKey();if(null==
l)throw Error(a.pcm.util.Constants.ELEMENT_HAS_NO_KEY_IN_COLLECTION);this._cells.put_wn2jw4$(null!=l?l:b.throwNPE(),p);p.addInboundReference(this,a.pcm.util.Constants.Ref_cells);p.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_cells,p),a.pcm.util.Constants.Ref_cells)}},doAddCells:function(m){var p=m.internalGetKey();if(null==p||b.equals(p,""))throw Error(a.pcm.util.Constants.EMPTY_KEY);this._cells.containsKey_za3rmp$(p)||
(this._cells.put_wn2jw4$(p,m),m.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_cells,m),a.pcm.util.Constants.Ref_cells),m.addInboundReference(this,a.pcm.util.Constants.Ref_cells))},addCells:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.doAddCells(b);return this},addAllCells:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
for(b=b.iterator();b.hasNext();){var p=b.next();this.doAddCells(p)}return this},removeCells:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);0!==this._cells.size()&&this._cells.containsKey_za3rmp$(b.internalGetKey())&&(this._cells.remove_za3rmp$(b.internalGetKey()),b.removeInboundReference(this,a.pcm.util.Constants.Ref_cells),b.setEContainer(null,null,null));return this},removeAllCells:function(){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
for(var b=this.cells.iterator();b.hasNext();){var p=b.next();p.removeInboundReference(this,a.pcm.util.Constants.Ref_cells);p.setEContainer(null,null,null)}this._cells.clear();return this},reflexiveMutator:function(m,p,l,h,q){if(p===a.pcm.util.Constants.Att_name)this.name=l;else if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Ref_cells)if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.addCells(null!=l?l:b.throwNPE());else if(m===
a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL)this.addAllCells(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.removeCells(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL)this.removeAllCells();else if(m===a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX){if(0!==this._cells.size()&&this._cells.containsKey_za3rmp$(l)){m=this._cells.get_za3rmp$(l);p=(null!=m?m:b.throwNPE()).internalGetKey();
if(null==p)throw Error("Key newed to null "+m);this._cells.remove_za3rmp$(l);this._cells.put_wn2jw4$(p,m)}}else throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+m);else throw Error("Can not reflexively "+m+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findCellsByID:function(a){return this._cells.get_za3rmp$(a)},findByID:function(b,p){return b===a.pcm.util.Constants.Ref_cells?this.findCellsByID(p):
null},visit:function(b,p,l,h){b.beginVisitElem(this);if(l){if(b.beginVisitRef(a.pcm.util.Constants.Ref_cells,a.pcm.util.Constants.pcm_Cell))for(var q=this._cells.keySet().iterator();q.hasNext();){var v=q.next();this.internal_visit(b,this._cells.get_za3rmp$(v),p,l,h,a.pcm.util.Constants.Ref_cells)}b.endVisitRef(a.pcm.util.Constants.Ref_cells)}b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.name,a.pcm.util.Constants.Att_name,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,
this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Product}}),RealValueImpl:b.createClass(function(){return[a.pcm.RealValue,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_2i5nlu$=this.$internal_containmentRefName_m5kvrt$=this.$internal_eContainer_de09xl$=null;this.$internal_recursive_readOnlyElem_wt23th$=this.$internal_readOnlyElem_abzczm$=!1;this.$internal_inboundReferences_o4me0c$=new b.ComplexHashMap;this.$is_root_8k6qf6$=this.$internal_is_deleted_al9i29$=this.$internal_deleteInProgress_61z0ye$=
!1;this.$key_cache_wjjveb$=this.$path_cache_404ucd$=null;this.$generated_KMF_ID_k7zgl$=""+Math.random()+(new Date).getTime();this.$value_zb2tgc$=a.pcm.util.Constants.DOUBLE_DEFAULTVAL},{internal_eContainer:{get:function(){return this.$internal_eContainer_de09xl$},set:function(a){this.$internal_eContainer_de09xl$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_m5kvrt$},set:function(a){this.$internal_containmentRefName_m5kvrt$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_2i5nlu$},
set:function(a){this.$internal_unsetCmd_2i5nlu$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_abzczm$},set:function(a){this.$internal_readOnlyElem_abzczm$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_wt23th$},set:function(a){this.$internal_recursive_readOnlyElem_wt23th$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_o4me0c$},set:function(a){this.$internal_inboundReferences_o4me0c$=
a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_61z0ye$},set:function(a){this.$internal_deleteInProgress_61z0ye$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_al9i29$},set:function(a){this.$internal_is_deleted_al9i29$=a}},is_root:{get:function(){return this.$is_root_8k6qf6$},set:function(a){this.$is_root_8k6qf6$=a}},path_cache:{get:function(){return this.$path_cache_404ucd$},set:function(a){this.$path_cache_404ucd$=a}},key_cache:{get:function(){return this.$key_cache_wjjveb$},
set:function(a){this.$key_cache_wjjveb$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_k7zgl$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_k7zgl$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},withValue:function(a){this.value=a;return this},value:{get:function(){return this.$value_zb2tgc$},set:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b!==this.value&&
(this.$value_zb2tgc$=b)}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Att_value)this.value=l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.value,
a.pcm.util.Constants.Att_value,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_RealValue}}),MultipleImpl:b.createClass(function(){return[a.pcm.Multiple,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_9fyr67$=this.$internal_containmentRefName_l4adm2$=this.$internal_eContainer_bqi3vq$=null;this.$internal_recursive_readOnlyElem_mpx0sc$=this.$internal_readOnlyElem_58fgoh$=!1;this.$internal_inboundReferences_xbrw9p$=
new b.ComplexHashMap;this.$is_root_wsgmkz$=this.$internal_is_deleted_ej8vr2$=this.$internal_deleteInProgress_s0nnsr$=!1;this.$key_cache_p8ppni$=this.$path_cache_jkklik$=null;this.$generated_KMF_ID_tlznwq$=""+Math.random()+(new Date).getTime();this._subvalues=new a.java.util.concurrent.ConcurrentHashMap},{internal_eContainer:{get:function(){return this.$internal_eContainer_bqi3vq$},set:function(a){this.$internal_eContainer_bqi3vq$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_l4adm2$},
set:function(a){this.$internal_containmentRefName_l4adm2$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_9fyr67$},set:function(a){this.$internal_unsetCmd_9fyr67$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_58fgoh$},set:function(a){this.$internal_readOnlyElem_58fgoh$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_mpx0sc$},set:function(a){this.$internal_recursive_readOnlyElem_mpx0sc$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_xbrw9p$},
set:function(a){this.$internal_inboundReferences_xbrw9p$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_s0nnsr$},set:function(a){this.$internal_deleteInProgress_s0nnsr$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_ej8vr2$},set:function(a){this.$internal_is_deleted_ej8vr2$=a}},is_root:{get:function(){return this.$is_root_wsgmkz$},set:function(a){this.$is_root_wsgmkz$=a}},path_cache:{get:function(){return this.$path_cache_jkklik$},set:function(a){this.$path_cache_jkklik$=
a}},key_cache:{get:function(){return this.$key_cache_p8ppni$},set:function(a){this.$key_cache_p8ppni$=a}},"delete":function(){this.internal_deleteInProgress=!0;for(var m=this.subvalues.iterator();m.hasNext();)m.next()["delete"]();this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var p;(null!=(p=this.internal_unsetCmd)?p:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=
a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_tlznwq$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_tlznwq$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},subvalues:{get:function(){return a.kotlin.toList_h3panj$(this._subvalues.values())},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(null==m)throw new b.IllegalArgumentException(a.pcm.util.Constants.LIST_PARAMETER_OF_SET_IS_NULL_EXCEPTION);this.internal_subvalues(m,!0,!0)}},internal_subvalues:function(m,p,l){if(!b.equals(this._subvalues.values(),m))for(this._subvalues.clear(),m=m.iterator();m.hasNext();){p=m.next();l=p.internalGetKey();if(null==l)throw Error(a.pcm.util.Constants.ELEMENT_HAS_NO_KEY_IN_COLLECTION);this._subvalues.put_wn2jw4$(null!=
l?l:b.throwNPE(),p);p.addInboundReference(this,a.pcm.util.Constants.Ref_subvalues);p.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_subvalues,p),a.pcm.util.Constants.Ref_subvalues)}},doAddSubvalues:function(m){var p=m.internalGetKey();if(null==p||b.equals(p,""))throw Error(a.pcm.util.Constants.EMPTY_KEY);this._subvalues.containsKey_za3rmp$(p)||(this._subvalues.put_wn2jw4$(p,m),m.setEContainer(this,
new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_subvalues,m),a.pcm.util.Constants.Ref_subvalues),m.addInboundReference(this,a.pcm.util.Constants.Ref_subvalues))},addSubvalues:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.doAddSubvalues(b);return this},addAllSubvalues:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);for(b=b.iterator();b.hasNext();){var p=
b.next();this.doAddSubvalues(p)}return this},removeSubvalues:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(2===a.kotlin.get_size(this._subvalues)&&this._subvalues.containsKey_za3rmp$(m.internalGetKey()))throw new b.UnsupportedOperationException("The list of subvaluesP must contain at least 2 element. Can not remove sizeof(subvaluesP)\x3d"+a.kotlin.get_size(this._subvalues));this._subvalues.remove_za3rmp$(m.internalGetKey());m.removeInboundReference(this,
a.pcm.util.Constants.Ref_subvalues);m.setEContainer(null,null,null);return this},removeAllSubvalues:function(){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);for(var b=this.subvalues.iterator();b.hasNext();){var p=b.next();p.removeInboundReference(this,a.pcm.util.Constants.Ref_subvalues);p.setEContainer(null,null,null)}this._subvalues.clear();return this},reflexiveMutator:function(m,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===
a.pcm.util.Constants.Ref_subvalues)if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.addSubvalues(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL)this.addAllSubvalues(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.removeSubvalues(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL)this.removeAllSubvalues();else if(m===a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX){if(0!==
this._subvalues.size()&&this._subvalues.containsKey_za3rmp$(l)){m=this._subvalues.get_za3rmp$(l);p=(null!=m?m:b.throwNPE()).internalGetKey();if(null==p)throw Error("Key newed to null "+m);this._subvalues.remove_za3rmp$(l);this._subvalues.put_wn2jw4$(p,m)}}else throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+m);else throw Error("Can not reflexively "+m+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},
findSubvaluesByID:function(a){return this._subvalues.get_za3rmp$(a)},findByID:function(b,p){return b===a.pcm.util.Constants.Ref_subvalues?this.findSubvaluesByID(p):null},visit:function(b,p,l,h){b.beginVisitElem(this);if(l){if(b.beginVisitRef(a.pcm.util.Constants.Ref_subvalues,a.pcm.util.Constants.pcm_Value))for(var q=this._subvalues.keySet().iterator();q.hasNext();){var v=q.next();this.internal_visit(b,this._subvalues.get_za3rmp$(v),p,l,h,a.pcm.util.Constants.Ref_subvalues)}b.endVisitRef(a.pcm.util.Constants.Ref_subvalues)}b.endVisitElem(this)},
visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Multiple}}),PCMImpl:b.createClass(function(){return[a.pcm.PCM,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_wx61np$=this.$internal_containmentRefName_1v3tc0$=this.$internal_eContainer_xoff3k$=null;this.$internal_recursive_readOnlyElem_yrv91u$=this.$internal_readOnlyElem_pdei79$=!1;this.$internal_inboundReferences_n7q0gd$=
new b.ComplexHashMap;this.$is_root_jtuno7$=this.$internal_is_deleted_uvon88$=this.$internal_deleteInProgress_kkemzz$=!1;this.$key_cache_vlo1dg$=this.$path_cache_3msixi$=null;this.$name_ehwpaf$=a.pcm.util.Constants.STRING_DEFAULTVAL;this.$generated_KMF_ID_ebuc6s$=""+Math.random()+(new Date).getTime();this._features=new a.java.util.concurrent.ConcurrentHashMap;this._products=new a.java.util.concurrent.ConcurrentHashMap},{internal_eContainer:{get:function(){return this.$internal_eContainer_xoff3k$},
set:function(a){this.$internal_eContainer_xoff3k$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_1v3tc0$},set:function(a){this.$internal_containmentRefName_1v3tc0$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_wx61np$},set:function(a){this.$internal_unsetCmd_wx61np$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_pdei79$},set:function(a){this.$internal_readOnlyElem_pdei79$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_yrv91u$},
set:function(a){this.$internal_recursive_readOnlyElem_yrv91u$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_n7q0gd$},set:function(a){this.$internal_inboundReferences_n7q0gd$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_kkemzz$},set:function(a){this.$internal_deleteInProgress_kkemzz$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_uvon88$},set:function(a){this.$internal_is_deleted_uvon88$=a}},
is_root:{get:function(){return this.$is_root_jtuno7$},set:function(a){this.$is_root_jtuno7$=a}},path_cache:{get:function(){return this.$path_cache_3msixi$},set:function(a){this.$path_cache_3msixi$=a}},key_cache:{get:function(){return this.$key_cache_vlo1dg$},set:function(a){this.$key_cache_vlo1dg$=a}},"delete":function(){this.internal_deleteInProgress=!0;for(var m=this.products.iterator();m.hasNext();)m.next()["delete"]();for(m=this.features.iterator();m.hasNext();)m.next()["delete"]();this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var p;(null!=(p=this.internal_unsetCmd)?p:b.throwNPE()).run()}this.internal_is_deleted=!0},withName:function(a){this.name=a;return this},name:{get:function(){return this.$name_ehwpaf$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);b.equals(m,this.name)||(this.$name_ehwpaf$=m)}},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_ebuc6s$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_ebuc6s$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},features:{get:function(){return a.kotlin.toList_h3panj$(this._features.values())},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
if(null==m)throw new b.IllegalArgumentException(a.pcm.util.Constants.LIST_PARAMETER_OF_SET_IS_NULL_EXCEPTION);this.internal_features(m,!0,!0)}},internal_features:function(m,p,l){if(!b.equals(this._features.values(),m))for(this._features.clear(),m=m.iterator();m.hasNext();){p=m.next();l=p.internalGetKey();if(null==l)throw Error(a.pcm.util.Constants.ELEMENT_HAS_NO_KEY_IN_COLLECTION);this._features.put_wn2jw4$(null!=l?l:b.throwNPE(),p);p.addInboundReference(this,a.pcm.util.Constants.Ref_features);p.setEContainer(this,
new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_features,p),a.pcm.util.Constants.Ref_features)}},doAddFeatures:function(m){var p=m.internalGetKey();if(null==p||b.equals(p,""))throw Error(a.pcm.util.Constants.EMPTY_KEY);this._features.containsKey_za3rmp$(p)||(this._features.put_wn2jw4$(p,m),m.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,
a.pcm.util.Constants.Ref_features,m),a.pcm.util.Constants.Ref_features),m.addInboundReference(this,a.pcm.util.Constants.Ref_features))},addFeatures:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.doAddFeatures(b);return this},addAllFeatures:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);for(b=b.iterator();b.hasNext();){var p=b.next();this.doAddFeatures(p)}return this},removeFeatures:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
0!==this._features.size()&&this._features.containsKey_za3rmp$(b.internalGetKey())&&(this._features.remove_za3rmp$(b.internalGetKey()),b.removeInboundReference(this,a.pcm.util.Constants.Ref_features),b.setEContainer(null,null,null));return this},removeAllFeatures:function(){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);for(var b=this.features.iterator();b.hasNext();){var p=b.next();p.removeInboundReference(this,a.pcm.util.Constants.Ref_features);p.setEContainer(null,null,
null)}this._features.clear();return this},products:{get:function(){return a.kotlin.toList_h3panj$(this._products.values())},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(null==m)throw new b.IllegalArgumentException(a.pcm.util.Constants.LIST_PARAMETER_OF_SET_IS_NULL_EXCEPTION);this.internal_products(m,!0,!0)}},internal_products:function(m,p,l){if(!b.equals(this._products.values(),m))for(this._products.clear(),m=m.iterator();m.hasNext();){p=m.next();l=
p.internalGetKey();if(null==l)throw Error(a.pcm.util.Constants.ELEMENT_HAS_NO_KEY_IN_COLLECTION);this._products.put_wn2jw4$(null!=l?l:b.throwNPE(),p);p.addInboundReference(this,a.pcm.util.Constants.Ref_products);p.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_products,p),a.pcm.util.Constants.Ref_products)}},doAddProducts:function(m){var p=m.internalGetKey();if(null==p||b.equals(p,""))throw Error(a.pcm.util.Constants.EMPTY_KEY);
this._products.containsKey_za3rmp$(p)||(this._products.put_wn2jw4$(p,m),m.setEContainer(this,new a.pcm.container.RemoveFromContainerCommand(this,a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,a.pcm.util.Constants.Ref_products,m),a.pcm.util.Constants.Ref_products),m.addInboundReference(this,a.pcm.util.Constants.Ref_products))},addProducts:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);this.doAddProducts(b);return this},addAllProducts:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
for(b=b.iterator();b.hasNext();){var p=b.next();this.doAddProducts(p)}return this},removeProducts:function(b){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);0!==this._products.size()&&this._products.containsKey_za3rmp$(b.internalGetKey())&&(this._products.remove_za3rmp$(b.internalGetKey()),b.removeInboundReference(this,a.pcm.util.Constants.Ref_products),b.setEContainer(null,null,null));return this},removeAllProducts:function(){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
for(var b=this.products.iterator();b.hasNext();){var p=b.next();p.removeInboundReference(this,a.pcm.util.Constants.Ref_products);p.setEContainer(null,null,null)}this._products.clear();return this},reflexiveMutator:function(m,p,l,h,q){if(p===a.pcm.util.Constants.Att_name)this.name=l;else if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Ref_products)if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.addProducts(null!=l?l:b.throwNPE());
else if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL)this.addAllProducts(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.removeProducts(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL)this.removeAllProducts();else if(m===a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX){if(0!==this._products.size()&&this._products.containsKey_za3rmp$(l)){m=this._products.get_za3rmp$(l);
p=(null!=m?m:b.throwNPE()).internalGetKey();if(null==p)throw Error("Key newed to null "+m);this._products.remove_za3rmp$(l);this._products.put_wn2jw4$(p,m)}}else throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+m);else if(p===a.pcm.util.Constants.Ref_features)if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD)this.addFeatures(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL)this.addAllFeatures(null!=l?l:b.throwNPE());else if(m===
a.org.kevoree.modeling.api.util.ActionType.object.REMOVE)this.removeFeatures(null!=l?l:b.throwNPE());else if(m===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL)this.removeAllFeatures();else if(m===a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX){if(0!==this._features.size()&&this._features.containsKey_za3rmp$(l)){m=this._features.get_za3rmp$(l);p=(null!=m?m:b.throwNPE()).internalGetKey();if(null==p)throw Error("Key newed to null "+m);this._features.remove_za3rmp$(l);this._features.put_wn2jw4$(p,
m)}}else throw Error(a.pcm.util.Constants.UNKNOWN_MUTATION_TYPE_EXCEPTION+m);else throw Error("Can not reflexively "+m+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findProductsByID:function(a){return this._products.get_za3rmp$(a)},findFeaturesByID:function(a){return this._features.get_za3rmp$(a)},findByID:function(b,p){return b===a.pcm.util.Constants.Ref_products?this.findProductsByID(p):b===a.pcm.util.Constants.Ref_features?
this.findFeaturesByID(p):null},visit:function(b,p,l,h){b.beginVisitElem(this);if(l){if(b.beginVisitRef(a.pcm.util.Constants.Ref_products,a.pcm.util.Constants.pcm_Product))for(var q=this._products.keySet().iterator();q.hasNext();){var v=q.next();this.internal_visit(b,this._products.get_za3rmp$(v),p,l,h,a.pcm.util.Constants.Ref_products)}b.endVisitRef(a.pcm.util.Constants.Ref_products);if(b.beginVisitRef(a.pcm.util.Constants.Ref_features,a.pcm.util.Constants.pcm_AbstractFeature))for(q=this._features.keySet().iterator();q.hasNext();)v=
q.next(),this.internal_visit(b,this._features.get_za3rmp$(v),p,l,h,a.pcm.util.Constants.Ref_features);b.endVisitRef(a.pcm.util.Constants.Ref_features)}b.endVisitElem(this)},visitAttributes:function(b){b.visit(this.name,a.pcm.util.Constants.Att_name,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_PCM}}),VersionImpl:b.createClass(function(){return[a.pcm.Version,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_4g7ul9$=
this.$internal_containmentRefName_wfp67y$=this.$internal_eContainer_a1mq4y$=null;this.$internal_recursive_readOnlyElem_4baik0$=this.$internal_readOnlyElem_e0aual$=!1;this.$internal_inboundReferences_gx7x81$=new b.ComplexHashMap;this.$is_root_9ypmef$=this.$internal_is_deleted_cudi0a$=this.$internal_deleteInProgress_5tlsa9$=!1;this.$key_cache_xeh8y6$=this.$path_cache_mmltrc$=null;this.$generated_KMF_ID_uethxm$=""+Math.random()+(new Date).getTime()},{internal_eContainer:{get:function(){return this.$internal_eContainer_a1mq4y$},
set:function(a){this.$internal_eContainer_a1mq4y$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_wfp67y$},set:function(a){this.$internal_containmentRefName_wfp67y$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_4g7ul9$},set:function(a){this.$internal_unsetCmd_4g7ul9$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_e0aual$},set:function(a){this.$internal_readOnlyElem_e0aual$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_4baik0$},
set:function(a){this.$internal_recursive_readOnlyElem_4baik0$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_gx7x81$},set:function(a){this.$internal_inboundReferences_gx7x81$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_5tlsa9$},set:function(a){this.$internal_deleteInProgress_5tlsa9$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_cudi0a$},set:function(a){this.$internal_is_deleted_cudi0a$=a}},
is_root:{get:function(){return this.$is_root_9ypmef$},set:function(a){this.$is_root_9ypmef$=a}},path_cache:{get:function(){return this.$path_cache_mmltrc$},set:function(a){this.$path_cache_mmltrc$=a}},key_cache:{get:function(){return this.$key_cache_xeh8y6$},set:function(a){this.$key_cache_xeh8y6$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;
(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_uethxm$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_uethxm$=m;null!=
l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},reflexiveMutator:function(b,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else throw Error("Can not reflexively "+b+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);a.endVisitElem(this)},
visitAttributes:function(b){b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_Version}}),BooleanValueImpl:b.createClass(function(){return[a.pcm.BooleanValue,a.pcm.container.KMFContainerImpl]},function(){this.$internal_unsetCmd_vp8y20$=this.$internal_containmentRefName_inmhs3$=this.$internal_eContainer_28cvf1$=null;this.$internal_recursive_readOnlyElem_c5d73f$=this.$internal_readOnlyElem_yu7lug$=!1;this.$internal_inboundReferences_x1i3e2$=
new b.ComplexHashMap;this.$is_root_q1idws$=this.$internal_is_deleted_513nad$=this.$internal_deleteInProgress_4yd95g$=!1;this.$key_cache_3lx7jr$=this.$path_cache_bryhxp$=null;this.$generated_KMF_ID_7eyonl$=""+Math.random()+(new Date).getTime();this.$value_2dbhve$=a.pcm.util.Constants.BOOLEAN_DEFAULTVAL},{internal_eContainer:{get:function(){return this.$internal_eContainer_28cvf1$},set:function(a){this.$internal_eContainer_28cvf1$=a}},internal_containmentRefName:{get:function(){return this.$internal_containmentRefName_inmhs3$},
set:function(a){this.$internal_containmentRefName_inmhs3$=a}},internal_unsetCmd:{get:function(){return this.$internal_unsetCmd_vp8y20$},set:function(a){this.$internal_unsetCmd_vp8y20$=a}},internal_readOnlyElem:{get:function(){return this.$internal_readOnlyElem_yu7lug$},set:function(a){this.$internal_readOnlyElem_yu7lug$=a}},internal_recursive_readOnlyElem:{get:function(){return this.$internal_recursive_readOnlyElem_c5d73f$},set:function(a){this.$internal_recursive_readOnlyElem_c5d73f$=a}},internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_x1i3e2$},
set:function(a){this.$internal_inboundReferences_x1i3e2$=a}},internal_deleteInProgress:{get:function(){return this.$internal_deleteInProgress_4yd95g$},set:function(a){this.$internal_deleteInProgress_4yd95g$=a}},internal_is_deleted:{get:function(){return this.$internal_is_deleted_513nad$},set:function(a){this.$internal_is_deleted_513nad$=a}},is_root:{get:function(){return this.$is_root_q1idws$},set:function(a){this.$is_root_q1idws$=a}},path_cache:{get:function(){return this.$path_cache_bryhxp$},set:function(a){this.$path_cache_bryhxp$=
a}},key_cache:{get:function(){return this.$key_cache_3lx7jr$},set:function(a){this.$key_cache_3lx7jr$=a}},"delete":function(){this.internal_deleteInProgress=!0;this.advertiseInboundRefs(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,this);this.internal_inboundReferences.clear();if(null!=this.internal_unsetCmd){var m;(null!=(m=this.internal_unsetCmd)?m:b.throwNPE()).run()}this.internal_is_deleted=!0},withGenerated_KMF_ID:function(a){this.generated_KMF_ID=a;return this},generated_KMF_ID:{get:function(){return this.$generated_KMF_ID_7eyonl$},
set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);if(!b.equals(m,this.generated_KMF_ID)){var p=this.internalGetKey(),l=this.eContainer(),h=this.getRefInParent();this.key_cache=this.path_cache=null;this.$generated_KMF_ID_7eyonl$=m;null!=l&&l.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX,null!=h?h:b.throwNPE(),p,!1,!1)}}},withValue:function(a){this.value=a;return this},value:{get:function(){return this.$value_2dbhve$},set:function(m){if(this.isReadOnly())throw Error(a.pcm.util.Constants.READ_ONLY_EXCEPTION);
b.equals(m,this.value)||(this.$value_2dbhve$=m)}},reflexiveMutator:function(m,p,l,h,q){if(p===a.pcm.util.Constants.Att_generated_KMF_ID)this.generated_KMF_ID=l;else if(p===a.pcm.util.Constants.Att_value)this.value=b.equals("true",l)||b.equals(!0,l);else throw Error("Can not reflexively "+m+" for "+p+" on "+this);},internalGetKey:function(){null==this.key_cache&&(this.key_cache=this.generated_KMF_ID);return this.key_cache},findByID:function(a,b){return null},visit:function(a,b,l,h){a.beginVisitElem(this);
a.endVisitElem(this)},visitAttributes:function(b){b.visit(this.value,a.pcm.util.Constants.Att_value,this);b.visit(this.generated_KMF_ID,a.pcm.util.Constants.Att_generated_KMF_ID,this)},metaClassName:function(){return a.pcm.util.Constants.pcm_BooleanValue}})})}),org:b.definePackage(null,{kevoree:b.definePackage(null,{modeling:b.definePackage(null,{api:b.definePackage(null,{time:b.definePackage(function(){this.TimeSegmentConst=b.createObject(null,function(){this.GLOBAL_TIMEMETA="#global"});this.TimeComparator=
b.createObject(null,null,{compare:function(a,b){return a===b?0:a<b?-1:1}})},{blob:b.definePackage(function(){this.RBCONST=b.createObject(null,function(){this.BLACK_DELETE="0";this.BLACK_EXISTS="1";this.RED_DELETE="2";this.RED_EXISTS="3"});this.MetaHelper=b.createObject(null,function(){this.sep="#";this.sep2="%"},{serialize:function(a){for(var p=new b.StringBuilder,l=!0,h=a.keySet().iterator();h.hasNext();){var q=h.next(),v,y=null!=(v=a.get_za3rmp$(q))?v:b.throwNPE();l||p.append(this.sep);p.append(q.path());
if(0!==y.size())for(l=y.iterator();l.hasNext();)q=l.next(),p.append(this.sep2),p.append(q);l=!1}return p.toString()},unserialize:function(a,p){var l=new b.ComplexHashMap,h,q,v;h=b.splitString(a,this.sep);q=h.length;for(v=0;v!==q;++v){var y=b.splitString(h[v],this.sep2);if(1<y.length){var w=new b.PrimitiveHashSet,u,r;u=y.length-1+1;for(var t=1;t!==u;t++)w.add_za3rmp$(y[t]);l.put_wn2jw4$(null!=(r=p.lookup(y[0]))?r:b.throwNPE(),w)}}return l}})},{SharedCache:b.createClass(null,function(){this.times_ynpjdh$=
new b.PrimitiveHashMap;this.timeCache=new a.java.util.concurrent.ConcurrentHashMap},{add:function(a,b){this.times_ynpjdh$.put_wn2jw4$(a,b)},get:function(a){return this.times_ynpjdh$.get_za3rmp$(a)},drop:function(a){this.times_ynpjdh$.remove_za3rmp$(a)},keys:function(){return this.times_ynpjdh$.keySet()},flush:function(){this.times_ynpjdh$.clear();this.timeCache.clear()}}),EntitiesMeta:b.createClass(null,function(){this.isDirty=!1;this.sep="#";this.list=new b.PrimitiveHashMap},{toString:function(){for(var a=
new b.StringBuilder,p=!0,l=this.list.keySet().iterator();l.hasNext();){var h=l.next();p||a.append(this.sep);a.append(h);p=!1}return a.toString()},load:function(a){if(!b.equals(a,"")){var p,l;a=b.splitString(a,this.sep);p=a.length;for(l=0;l!==p;++l)this.list.put_wn2jw4$(a[l],!0);this.isDirty=!1}}}),EntityMeta:b.createClass(null,function(){this.metatype=this.latestPersisted=null;this.sep="/"},{toString:function(){var a=new b.StringBuilder;a.append(this.latestPersisted);a.append(this.sep);a.append(this.metatype);
return a.toString()},load:function(m){m=b.splitString(m,this.sep);if(2===m.length){var p=m[0];b.equals(p,"")||(this.latestPersisted=a.java.lang.Long.parseLong(p));this.metatype=m[1]}else throw Error("Bad EntityTimeMeta format");}}),Color:b.createClass(function(){return[b.Enum]},function p(){p.baseInitializer.call(this)},null,{object_initializer$:function(){return b.createEnumEntries({RED:new a.org.kevoree.modeling.api.time.blob.Color,BLACK:new a.org.kevoree.modeling.api.time.blob.Color})}}),STATE:b.createClass(function(){return[b.Enum]},
function l(){l.baseInitializer.call(this)},null,{object_initializer$:function(){return b.createEnumEntries({EXISTS:new a.org.kevoree.modeling.api.time.blob.STATE,DELETED:new a.org.kevoree.modeling.api.time.blob.STATE})}}),Node:b.createClass(null,function(a,h,q,v,y){this.key=a;this.value=h;this.color=q;this.left=v;this.right=y;this.parent=null;if(null!=this.left){var w;(null!=(w=this.left)?w:b.throwNPE()).parent=this}if(null!=this.right){var u;(null!=(u=this.right)?u:b.throwNPE()).parent=this}this.parent=
null},{grandparent:function(){var a;return null!=(a=this.parent)?a.parent:null},sibling:function(){var a;if(b.equals(this,null!=(a=this.parent)?a.left:null)){var h;return null!=(h=this.parent)?h.right:null}var q;return null!=(q=this.parent)?q.left:null},uncle:function(){var a;return null!=(a=this.parent)?a.sibling():null},serialize:function(l){l.append("|");b.equals(this.value,a.org.kevoree.modeling.api.time.blob.STATE.object.DELETED)?b.equals(this.color,a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)?
l.append(a.org.kevoree.modeling.api.time.blob.RBCONST.BLACK_DELETE):l.append(a.org.kevoree.modeling.api.time.blob.RBCONST.RED_DELETE):b.equals(this.color,a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)?l.append(a.org.kevoree.modeling.api.time.blob.RBCONST.BLACK_EXISTS):l.append(a.org.kevoree.modeling.api.time.blob.RBCONST.RED_EXISTS);l.append(this.key);if(null==this.left&&null==this.right)l.append("%");else{if(null!=this.left){var h;null!=(h=this.left)?h.serialize(l):null}else l.append("#");
if(null!=this.right){var q;null!=(q=this.right)?q.serialize(l):null}else l.append("#")}},next:function(){var a=this;if(null!=(null!=a?a:b.throwNPE()).right){for(var h,a=null!=(h=(null!=a?a:b.throwNPE()).right)?h:b.throwNPE();null!=(null!=a?a:b.throwNPE()).left;)var q,a=null!=(q=(null!=a?a:b.throwNPE()).left)?q:b.throwNPE();return a}if(null!=(null!=a?a:b.throwNPE()).parent){var v;if(b.equals(a,(null!=(v=(null!=a?a:b.throwNPE()).parent)?v:b.throwNPE()).left)){var y;return null!=(y=(null!=a?a:b.throwNPE()).parent)?
y:b.throwNPE()}for(var w;null!=(null!=a?a:b.throwNPE()).parent&&b.equals(a,(null!=(w=(null!=a?a:b.throwNPE()).parent)?w:b.throwNPE()).right);)var u,a=null!=(u=(null!=a?a:b.throwNPE()).parent)?u:b.throwNPE();return(null!=a?a:b.throwNPE()).parent}return null},previous:function(){var a=this;if(null!=(null!=a?a:b.throwNPE()).left){for(var h,a=null!=(h=(null!=a?a:b.throwNPE()).left)?h:b.throwNPE();null!=(null!=a?a:b.throwNPE()).right;)var q,a=null!=(q=(null!=a?a:b.throwNPE()).right)?q:b.throwNPE();return a}if(null!=
(null!=a?a:b.throwNPE()).parent){var v;if(b.equals(a,(null!=(v=(null!=a?a:b.throwNPE()).parent)?v:b.throwNPE()).right)){var y;return null!=(y=(null!=a?a:b.throwNPE()).parent)?y:b.throwNPE()}for(var w;null!=(null!=a?a:b.throwNPE()).parent&&b.equals(a,(null!=(w=(null!=a?a:b.throwNPE()).parent)?w:b.throwNPE()).left);)var u,a=null!=(u=(null!=a?a:b.throwNPE()).parent)?u:b.throwNPE();return(null!=a?a:b.throwNPE()).parent}return null}}),ReaderContext:b.createClass(null,function(a,b){this.payload=a;this.offset=
b},{unserialize:function(l){if(this.offset>=this.payload.length)return null;var h=new b.StringBuilder,q=this.payload.charAt(this.offset);if("%"===q)return l&&(this.offset+=1),null;if("#"===q)return this.offset+=1,null;if("|"!==q)throw Error("Error while loading BTree");this.offset+=1;q=this.payload.charAt(this.offset);l=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;var v=a.org.kevoree.modeling.api.time.blob.STATE.object.EXISTS;q===a.org.kevoree.modeling.api.time.blob.RBCONST.BLACK_DELETE?
(l=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK,v=a.org.kevoree.modeling.api.time.blob.STATE.object.DELETED):q===a.org.kevoree.modeling.api.time.blob.RBCONST.BLACK_EXISTS?(l=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK,v=a.org.kevoree.modeling.api.time.blob.STATE.object.EXISTS):q===a.org.kevoree.modeling.api.time.blob.RBCONST.RED_DELETE?(l=a.org.kevoree.modeling.api.time.blob.Color.object.RED,v=a.org.kevoree.modeling.api.time.blob.STATE.object.DELETED):q===a.org.kevoree.modeling.api.time.blob.RBCONST.RED_EXISTS&&
(l=a.org.kevoree.modeling.api.time.blob.Color.object.RED,v=a.org.kevoree.modeling.api.time.blob.STATE.object.EXISTS);this.offset+=1;for(q=this.payload.charAt(this.offset);this.offset+1<this.payload.length&&"|"!==q&&"#"!==q&&"%"!==q;)h.append(q),this.offset+=1,q=this.payload.charAt(this.offset);"|"!==q&&"#"!==q&&"%"!==q&&h.append(q);h=new a.org.kevoree.modeling.api.time.blob.Node(a.java.lang.Long.parseLong(h.toString()),v,l,null,null);q=this.unserialize(!1);null!=q&&(q.parent=h);l=this.unserialize(!0);
null!=l&&(l.parent=h);h.left=q;h.right=l;return h}}),RBTree:b.createClass(null,function(){this.root=null;this.size_pjslhb$=0},{size:function(){return this.size_pjslhb$},serialize:function(){var a=new b.StringBuilder;a.append(this.size_pjslhb$);var h;null!=(h=this.root)?h.serialize(a):null;return a.toString()},unserialize:function(l){if(0!==a.kotlin.get_size_0(l)){for(var h=0,q=new b.StringBuilder,v=l.charAt(h);h<l.length&&"|"!==v;)q.append(v),h+=1,v=l.charAt(h);this.size_pjslhb$=a.java.lang.Integer.parseInt(q.toString());
this.root=(new a.org.kevoree.modeling.api.time.blob.ReaderContext(l,h)).unserialize(!0)}},previousOrEqual:function(a){var h=this.root;if(null==h)return null;for(;null!=h;){if(a===(null!=h?h:b.throwNPE()).key)return h;if(a>(null!=h?h:b.throwNPE()).key)if(null!=(null!=h?h:b.throwNPE()).right)h=(null!=h?h:b.throwNPE()).right;else return h;else if(null!=(null!=h?h:b.throwNPE()).left)h=(null!=h?h:b.throwNPE()).left;else{for(a=(null!=h?h:b.throwNPE()).parent;null!=a&&b.equals(h,(null!=a?a:b.throwNPE()).left);)h=
a,a=(null!=a?a:b.throwNPE()).parent;return a}}return null},nextOrEqual:function(a){var h=this.root;if(null==h)return null;for(;null!=h;){if(a===(null!=h?h:b.throwNPE()).key)return h;if(a<(null!=h?h:b.throwNPE()).key)if(null!=(null!=h?h:b.throwNPE()).left)h=(null!=h?h:b.throwNPE()).left;else return h;else if(null!=(null!=h?h:b.throwNPE()).right)h=(null!=h?h:b.throwNPE()).right;else{for(a=(null!=h?h:b.throwNPE()).parent;null!=a&&b.equals(h,(null!=a?a:b.throwNPE()).right);)h=a,a=(null!=a?a:b.throwNPE()).parent;
return a}}return null},previous:function(a){var h=this.root;if(null==h)return null;for(;null!=h;)if(a<(null!=h?h:b.throwNPE()).key)if(null!=(null!=h?h:b.throwNPE()).left)var q,h=null!=(q=(null!=h?h:b.throwNPE()).left)?q:b.throwNPE();else return(null!=h?h:b.throwNPE()).previous();else if(a>(null!=h?h:b.throwNPE()).key)if(null!=(null!=h?h:b.throwNPE()).right)var v,h=null!=(v=(null!=h?h:b.throwNPE()).right)?v:b.throwNPE();else return h;else return(null!=h?h:b.throwNPE()).previous();return null},previousWhileNot:function(a,
h){var q=this.previousOrEqual(a);if(b.equals((null!=q?q:b.throwNPE()).value,h))return null;(null!=q?q:b.throwNPE()).key===a&&(q=(null!=q?q:b.throwNPE()).previous());return null==q||b.equals((null!=q?q:b.throwNPE()).value,h)?null:q},next:function(a){var h=this.root;if(null==h)return null;for(;null!=h;)if(a<(null!=h?h:b.throwNPE()).key)if(null!=(null!=h?h:b.throwNPE()).left)var q,h=null!=(q=(null!=h?h:b.throwNPE()).left)?q:b.throwNPE();else return h;else if(a>(null!=h?h:b.throwNPE()).key)if(null!=(null!=
h?h:b.throwNPE()).right)var v,h=null!=(v=(null!=h?h:b.throwNPE()).right)?v:b.throwNPE();else return(null!=h?h:b.throwNPE()).next();else return(null!=h?h:b.throwNPE()).next();return null},nextWhileNot:function(a,h){var q=this.nextOrEqual(a);if(b.equals((null!=q?q:b.throwNPE()).value,h))return null;(null!=q?q:b.throwNPE()).key===a&&(q=(null!=q?q:b.throwNPE()).next());return null==q||b.equals((null!=q?q:b.throwNPE()).value,h)?null:q},first:function(){var a=this.root;if(null==a)return null;for(;null!=
a;)if(null!=(null!=a?a:b.throwNPE()).left)var h,a=null!=(h=(null!=a?a:b.throwNPE()).left)?h:b.throwNPE();else return a;return null},last:function(){var a=this.root;if(null==a)return null;for(;null!=a;)if(null!=(null!=a?a:b.throwNPE()).right)var h,a=null!=(h=(null!=a?a:b.throwNPE()).right)?h:b.throwNPE();else return a;return null},firstWhileNot:function(a,h){var q=this.previousOrEqual(a);if(null==q||b.equals((null!=q?q:b.throwNPE()).value,h))return null;var v;do{v=(null!=q?q:b.throwNPE()).previous();
if(null==v||b.equals((null!=v?v:b.throwNPE()).value,h))return q;q=v}while(null!=q);return v},lastWhileNot:function(a,h){var q=this.previousOrEqual(a);if(null==q||b.equals((null!=q?q:b.throwNPE()).value,h))return null;var v;do{v=(null!=q?q:b.throwNPE()).next();if(null==v||b.equals((null!=v?v:b.throwNPE()).value,h))return q;q=v}while(null!=q);return v},lookupNode:function(a){var h=this.root;if(null==h)return null;for(;null!=h&&a!==(null!=h?h:b.throwNPE()).key;)h=a<(null!=h?h:b.throwNPE()).key?(null!=
h?h:b.throwNPE()).left:(null!=h?h:b.throwNPE()).right;return h},lookup:function(a){a=this.lookupNode(a);return null==a?null:a.value},rotateLeft:function(a){var h=a.right;this.replaceNode(a,null!=h?h:b.throwNPE());a.right=h.left;if(null!=h.left){var q;(null!=(q=h.left)?q:b.throwNPE()).parent=a}h.left=a;a.parent=h},rotateRight:function(a){var h=a.left;this.replaceNode(a,null!=h?h:b.throwNPE());a.left=h.right;if(null!=h.right){var q;(null!=(q=h.right)?q:b.throwNPE()).parent=a}h.right=a;a.parent=h},replaceNode:function(a,
h){if(null==a.parent)this.root=h;else{var q;if(b.equals(a,(null!=(q=a.parent)?q:b.throwNPE()).left)){var v;(null!=(v=a.parent)?v:b.throwNPE()).left=h}else{var y;(null!=(y=a.parent)?y:b.throwNPE()).right=h}}null!=h&&(h.parent=a.parent)},insert:function(l,h){var q=new a.org.kevoree.modeling.api.time.blob.Node(l,h,a.org.kevoree.modeling.api.time.blob.Color.object.RED,null,null);if(null==this.root)this.size_pjslhb$++,this.root=q;else{for(var v=this.root;;){if(l===(null!=v?v:b.throwNPE()).key){(null!=
v?v:b.throwNPE()).value=h;return}if(l<(null!=v?v:b.throwNPE()).key)if(null==(null!=v?v:b.throwNPE()).left){(null!=v?v:b.throwNPE()).left=q;this.size_pjslhb$++;break}else var y,v=null!=(y=(null!=v?v:b.throwNPE()).left)?y:b.throwNPE();else if(null==(null!=v?v:b.throwNPE()).right){(null!=v?v:b.throwNPE()).right=q;this.size_pjslhb$++;break}else v=(null!=v?v:b.throwNPE()).right}q.parent=v}this.insertCase1(q)},insertCase1:function(b){null==b.parent?b.color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK:
this.insertCase2(b)},insertCase2:function(l){b.equals(this.nodeColor(l.parent),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)||this.insertCase3(l)},insertCase3:function(l){if(b.equals(this.nodeColor(l.uncle()),a.org.kevoree.modeling.api.time.blob.Color.object.RED)){var h,q,v,y;(null!=(h=l.parent)?h:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;(null!=(q=l.uncle())?q:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;(null!=(v=l.grandparent())?
v:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.RED;this.insertCase1(null!=(y=l.grandparent())?y:b.throwNPE())}else this.insertCase4(l)},insertCase4:function(a){var h,q;if(b.equals(a,(null!=(h=a.parent)?h:b.throwNPE()).right)&&b.equals(a.parent,(null!=(q=a.grandparent())?q:b.throwNPE()).left)){var v,y;this.rotateLeft(null!=(v=a.parent)?v:b.throwNPE());a=null!=(y=a.left)?y:b.throwNPE()}else{var w,u;if(b.equals(a,(null!=(w=a.parent)?w:b.throwNPE()).left)&&b.equals(a.parent,(null!=
(u=a.grandparent())?u:b.throwNPE()).right)){var r,t;this.rotateRight(null!=(r=a.parent)?r:b.throwNPE());a=null!=(t=a.right)?t:b.throwNPE()}}this.insertCase5(a)},insertCase5:function(l){var h,q,v,y;(null!=(h=l.parent)?h:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;(null!=(q=l.grandparent())?q:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.RED;if(b.equals(l,(null!=(v=l.parent)?v:b.throwNPE()).left)&&b.equals(l.parent,(null!=(y=l.grandparent())?y:
b.throwNPE()).left)){var w;this.rotateRight(null!=(w=l.grandparent())?w:b.throwNPE())}else{var u;this.rotateLeft(null!=(u=l.grandparent())?u:b.throwNPE())}},"delete":function(l){l=this.lookupNode(l);if(null!=l){this.size_pjslhb$--;if(null!=(null!=l?l:b.throwNPE()).left&&null!=(null!=l?l:b.throwNPE()).right){for(var h,q=null!=(h=(null!=l?l:b.throwNPE()).left)?h:b.throwNPE();null!=q.right;)var v,q=null!=(v=q.right)?v:b.throwNPE();(null!=l?l:b.throwNPE()).key=q.key;(null!=l?l:b.throwNPE()).value=q.value;
l=q}h=null==(null!=l?l:b.throwNPE()).right?(null!=l?l:b.throwNPE()).left:(null!=l?l:b.throwNPE()).right;b.equals(this.nodeColor(l),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&((null!=l?l:b.throwNPE()).color=this.nodeColor(h),this.deleteCase1(null!=l?l:b.throwNPE()));this.replaceNode(null!=l?l:b.throwNPE(),h)}},deleteCase1:function(a){null!=a.parent&&this.deleteCase2(a)},deleteCase2:function(l){if(b.equals(this.nodeColor(l.sibling()),a.org.kevoree.modeling.api.time.blob.Color.object.RED)){var h,
q,v;(null!=(h=l.parent)?h:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.RED;(null!=(q=l.sibling())?q:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;if(b.equals(l,(null!=(v=l.parent)?v:b.throwNPE()).left)){var y;this.rotateLeft(null!=(y=l.parent)?y:b.throwNPE())}else{var w;this.rotateRight(null!=(w=l.parent)?w:b.throwNPE())}}this.deleteCase3(l)},deleteCase3:function(l){var h,q;if(b.equals(this.nodeColor(l.parent),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&
b.equals(this.nodeColor(l.sibling()),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&b.equals(this.nodeColor((null!=(h=l.sibling())?h:b.throwNPE()).left),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&b.equals(this.nodeColor((null!=(q=l.sibling())?q:b.throwNPE()).right),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)){var v,y;(null!=(v=l.sibling())?v:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.RED;this.deleteCase1(null!=(y=l.parent)?y:b.throwNPE())}else this.deleteCase4(l)},
deleteCase4:function(l){var h,q;if(b.equals(this.nodeColor(l.parent),a.org.kevoree.modeling.api.time.blob.Color.object.RED)&&b.equals(this.nodeColor(l.sibling()),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&b.equals(this.nodeColor((null!=(h=l.sibling())?h:b.throwNPE()).left),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&b.equals(this.nodeColor((null!=(q=l.sibling())?q:b.throwNPE()).right),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)){var v,y;(null!=(v=l.sibling())?
v:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.RED;(null!=(y=l.parent)?y:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK}else this.deleteCase5(l)},deleteCase5:function(l){var h,q,v,y,w,u;if(b.equals(l,(null!=(h=l.parent)?h:b.throwNPE()).left)&&b.equals(this.nodeColor(l.sibling()),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&b.equals(this.nodeColor((null!=(q=l.sibling())?q:b.throwNPE()).left),a.org.kevoree.modeling.api.time.blob.Color.object.RED)&&
b.equals(this.nodeColor((null!=(v=l.sibling())?v:b.throwNPE()).right),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)){var r,t,n,s;(null!=(r=l.sibling())?r:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.RED;(null!=(n=(null!=(t=l.sibling())?t:b.throwNPE()).left)?n:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;this.rotateRight(null!=(s=l.sibling())?s:b.throwNPE())}else if(b.equals(l,(null!=(y=l.parent)?y:b.throwNPE()).right)&&b.equals(this.nodeColor(l.sibling()),
a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)&&b.equals(this.nodeColor((null!=(w=l.sibling())?w:b.throwNPE()).right),a.org.kevoree.modeling.api.time.blob.Color.object.RED)&&b.equals(this.nodeColor((null!=(u=l.sibling())?u:b.throwNPE()).left),a.org.kevoree.modeling.api.time.blob.Color.object.BLACK)){var f,d,c,e;(null!=(f=l.sibling())?f:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.RED;(null!=(c=(null!=(d=l.sibling())?d:b.throwNPE()).right)?c:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;
this.rotateLeft(null!=(e=l.sibling())?e:b.throwNPE())}this.deleteCase6(l)},deleteCase6:function(l){var h,q,v;(null!=(h=l.sibling())?h:b.throwNPE()).color=this.nodeColor(l.parent);(null!=(q=l.parent)?q:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;if(b.equals(l,(null!=(v=l.parent)?v:b.throwNPE()).left)){var y,w,u;(null!=(w=(null!=(y=l.sibling())?y:b.throwNPE()).right)?w:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;this.rotateLeft(null!=(u=
l.parent)?u:b.throwNPE())}else{var r,t,n;(null!=(t=(null!=(r=l.sibling())?r:b.throwNPE()).left)?t:b.throwNPE()).color=a.org.kevoree.modeling.api.time.blob.Color.object.BLACK;this.rotateRight(null!=(n=l.parent)?n:b.throwNPE())}},nodeColor:function(b){return null==b?a.org.kevoree.modeling.api.time.blob.Color.object.BLACK:b.color}}),TimeMeta:b.createClass(function(){return[a.org.kevoree.modeling.api.time.TimeTree]},function(){this.dirty=!0;this.versionTree=new a.org.kevoree.modeling.api.time.blob.RBTree},
{first:function(){var a;return null!=(a=this.versionTree.first())?a.key:null},last:function(){var a;return null!=(a=this.versionTree.last())?a.key:null},next:function(a){var b;return null!=(b=this.versionTree.next(a))?b.key:null},previous:function(a){var b;return null!=(b=this.versionTree.previous(a))?b.key:null},walk:function(a){return this.walkAsc(a)},toString:function(){return this.versionTree.serialize()},load:function(a){this.versionTree.unserialize(a);this.dirty=!1},walkAsc:function(a){for(var h=
this.versionTree.first();null!=h;)a.walk((null!=h?h:b.throwNPE()).key),h=(null!=h?h:b.throwNPE()).next()},walkDesc:function(a){for(var h=this.versionTree.last();null!=h;)a.walk((null!=h?h:b.throwNPE()).key),h=(null!=h?h:b.throwNPE()).previous()},walkRangeAsc:function(a,h,q){var v=h,y=q;h>q&&(v=q,y=h);for(h=this.versionTree.previousOrEqual(v);null!=h&&!(a.walk((null!=h?h:b.throwNPE()).key),h=(null!=h?h:b.throwNPE()).next(),null!=h&&(null!=h?h:b.throwNPE()).key>=y););},walkRangeDesc:function(a,h,q){var v=
h,y=q;h>q&&(v=q,y=h);for(h=this.versionTree.previousOrEqual(y);null!=h;)if(a.walk((null!=h?h:b.throwNPE()).key),h=(null!=h?h:b.throwNPE()).previous(),null!=h&&(null!=h?h:b.throwNPE()).key<=v){a.walk((null!=h?h:b.throwNPE()).key);break}}},{object_initializer$:function(){return b.createObject(null,function(){this.GO_DOWN_LEFT=0;this.GO_DOWN_RIGHT=1;this.PROCESS_PREFIX=2;this.PROCESS_INFIX=3;this.PROCESS_POSTFIX=4})}})}),TimeView:b.createTrait(null),TimeAwareKMFContainer:b.createTrait(function(){return[a.org.kevoree.modeling.api.TimedContainer,
a.org.kevoree.modeling.api.persistence.KMFContainerProxy]},{meta:{get:function(){return this.$meta_e0ta8m$},set:function(a){this.$meta_e0ta8m$=a}},getOriginTransaction:function(){var a;return(null!=(a=this.originFactory)?a:b.throwNPE()).originTransaction},previous:function(){var a=this.timeTree().previous(this.now);return null!=a?this.getOriginTransaction().time(a).lookup(this.path()):null},next:function(){var a=this.timeTree().next(this.now);return null!=a?this.getOriginTransaction().time(a).lookup(this.path()):
null},last:function(){var b,h=null!=(b=this.timeTree().versionTree.lastWhileNot(this.now,a.org.kevoree.modeling.api.time.blob.STATE.object.DELETED))?b.key:null;return null!=h?this.getOriginTransaction().time(h).lookup(this.path()):null},first:function(){var b,h=null!=(b=this.timeTree().versionTree.firstWhileNot(this.now,a.org.kevoree.modeling.api.time.blob.STATE.object.DELETED))?b.key:null;return null!=h?this.getOriginTransaction().time(h).lookup(this.path()):null},jump:function(a){a=this.timeTree().previous(a);
return null!=a?this.getOriginTransaction().time(a).lookup(this.path()):null},timeTree:function(){var a;return(null!=(a=this.originFactory)?a:b.throwNPE()).getTimeTree(this.path())}}),TimeSegment:b.createClass(function(){return[b.Enum]},function h(){h.baseInitializer.call(this)},null,{object_initializer$:function(){return b.createEnumEntries({RAW:new a.org.kevoree.modeling.api.time.TimeSegment,ENTITYMETA:new a.org.kevoree.modeling.api.time.TimeSegment,TIMEMETA:new a.org.kevoree.modeling.api.time.TimeSegment,
ENTITIES:new a.org.kevoree.modeling.api.time.TimeSegment})}}),TimeAwareKMFFactory:b.createTrait(function(){return[a.org.kevoree.modeling.api.time.TimeView,a.org.kevoree.modeling.api.persistence.PersistenceKMFFactory]},{relativeTime:{get:function(){return this.$relativeTime_53j5cx$}},sharedCache:{get:function(){return this.$sharedCache_s3os97$}},entitiesCache:{get:function(){return this.$entitiesCache_hk1jbt$},set:function(a){this.$entitiesCache_hk1jbt$=a}},originTransaction:{get:function(){return this.$originTransaction_8vjs1c$},
set:function(a){this.$originTransaction_8vjs1c$=a}},getEntitiesMeta:function(){if(null!=this.entitiesCache){var h;return null!=(h=this.entitiesCache)?h:b.throwNPE()}h=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.ENTITIES.name(),this.relativeTime.toString());var q=new a.org.kevoree.modeling.api.time.blob.EntitiesMeta;null!=h&&q.load(h);return this.entitiesCache=q},endCommit:function(){for(var b=this.getEntitiesMeta(),q=b.list.keySet().iterator();q.hasNext();){var v=q.next(),
y=this.getTimeTree(v);y.dirty&&(this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.TIMEMETA.name(),v,y.toString()),y.dirty=!1)}b.isDirty&&(this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.ENTITIES.name(),this.relativeTime.toString(),b.toString()),b.isDirty=!1);b=this.getTimeTree(a.org.kevoree.modeling.api.time.TimeSegmentConst.GLOBAL_TIMEMETA);b.dirty&&(this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.TIMEMETA.name(),a.org.kevoree.modeling.api.time.TimeSegmentConst.GLOBAL_TIMEMETA,
b.toString()),b.dirty=!1);for(b=this.elementsToBeRemoved.iterator();b.hasNext();)q=b.next(),this.cleanUnusedPaths(q);this.elementsToBeRemoved.clear();this.datastore.commit()},clear:function(){var h;null!=this.entitiesCache&&(null!=(h=this.entitiesCache)?h:b.throwNPE()).isDirty&&b.println("WARNING :: CLOSED TimeView in dirty mode ! "+this.relativeTime);a.org.kevoree.modeling.api.persistence.PersistenceKMFFactory.prototype.clear.call(this);this.entitiesCache=null},monitor:function(b){if(!this.dirty){this.dirty=
!0;var q=this.getTimeTree(a.org.kevoree.modeling.api.time.TimeSegmentConst.GLOBAL_TIMEMETA);null==q.versionTree.lookup(this.relativeTime)&&(q.versionTree.insert(this.relativeTime,a.org.kevoree.modeling.api.time.blob.STATE.object.EXISTS),q.dirty=!0)}b.addModelElementListener(this)},commit:function(){for(var h=a.kotlin.toList_h3panj$(this.modified_elements.keySet()).iterator();h.hasNext();){var q=h.next(),v=this.modified_elements.get_za3rmp$(q);null!=v&&b.equals(v.path(),"")&&(v.isDeleted()?this.modified_elements.remove_za3rmp$(q):
v["delete"]())}for(h=this.modified_elements.values().iterator();h.hasNext();)q=h.next(),this.persist(q),this.elementsToBeRemoved.remove_za3rmp$(q.path())},persist:function(h){if(!b.isType(h,a.org.kevoree.modeling.api.persistence.KMFContainerProxy)||h.isDirty){var q=h.path();if(b.equals(q,""))throw Error("Internal error, empty path found during persist method "+h);if(!q.startsWith("/"))throw Error("Cannot persist, because the path of the element do not refer to a root: "+q+" -\x3e "+h);var v=h.toTraces(!0,
!0),y=new a.org.kevoree.modeling.api.trace.TraceSequence(this);y.populate(v);v=this.getEntitiesMeta();v.list.put_wn2jw4$(q,!0);v.isDirty=!0;v=this.relativeTime.toString()+"/"+q;this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),v,y.exportToString());y=a.org.kevoree.modeling.api.time.blob.MetaHelper.serialize(h.internal_inboundReferences);this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),v+"#",y);var w;(null!=(w=h.meta)?w:b.throwNPE()).latestPersisted=
this.relativeTime;this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.ENTITYMETA.name(),v,b.toString(h.meta));h=this.getTimeTree(q);null==h.versionTree.lookup(this.relativeTime)&&(h.versionTree.insert(this.relativeTime,a.org.kevoree.modeling.api.time.blob.STATE.object.EXISTS),h.dirty=!0)}},remove:function(h){if(!h.isDeleted()){var q=h.path();if(b.equals(q,""))this.modified_elements.remove_za3rmp$(h),b.println("WARNING :: Can't process dangling element! type:"+h.metaClassName()+",id\x3d"+
h.internalGetKey()+" ignored");else{this.elem_cache.remove_za3rmp$(q);var v=this.getTimeTree(q);v.versionTree.insert(this.relativeTime,a.org.kevoree.modeling.api.time.blob.STATE.object.DELETED);v.dirty=!0;v=this.getEntitiesMeta();v.list.put_wn2jw4$(q,!0);v.isDirty=!0;this.dirty||(q=this.getTimeTree(a.org.kevoree.modeling.api.time.TimeSegmentConst.GLOBAL_TIMEMETA),null==q.versionTree.lookup(this.relativeTime)&&(q.versionTree.insert(this.relativeTime,a.org.kevoree.modeling.api.time.blob.STATE.object.EXISTS),
q.dirty=!0));this.modified_elements.remove_za3rmp$(b.hashCode(h).toString())}}},cleanUnusedPaths:function(b){b=this.relativeTime.toString()+"/"+b;this.datastore.remove(a.org.kevoree.modeling.api.time.TimeSegment.object.ENTITYMETA.name(),b);this.datastore.remove(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),b);this.datastore.remove(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),b+"#")},getTimeTree:function(b){var q=this.sharedCache.timeCache.get_za3rmp$(b);if(null!=q)return q;
var q=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.TIMEMETA.name(),b),v=new a.org.kevoree.modeling.api.time.blob.TimeMeta;null!=q&&v.load(q);this.sharedCache.timeCache.put_wn2jw4$(b,v);return v},lookup:function(h){var q=this.getTimeTree(h).versionTree.previousOrEqual(this.relativeTime),v=null!=q?q.key:null;if(null==v||b.equals((null!=q?q:b.throwNPE()).value,a.org.kevoree.modeling.api.time.blob.STATE.object.DELETED))return null;q=b.toString(v)+"/"+h;if(this.elem_cache.containsKey_za3rmp$(q))return this.elem_cache.get_za3rmp$(q);
var y=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.ENTITYMETA.name(),q);if(null==y)return null;var w=new a.org.kevoree.modeling.api.time.blob.EntityMeta;w.load(y);if(null!=w.metatype){var u,r,y=null!=(r=this.create(null!=(u=w.metatype)?u:b.throwNPE()))?r:b.throwNPE();y.meta=w;this.elem_cache.put_wn2jw4$(q,y);y.isResolved=!1;y.now=v;y.setOriginPath(h);this.monitor(y);return y}throw Error("Empty Type Name for "+h);},getTraces:function(h){var q=h.path(),v=new a.org.kevoree.modeling.api.trace.TraceSequence(this),
y,w;if(null==(null!=(y=h.meta)?y:b.throwNPE()).latestPersisted)return null;h=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),b.toString((null!=(w=h.meta)?w:b.throwNPE()).latestPersisted)+"/"+q);return null!=h?(v.populateFromString(null!=h?h:b.throwNPE()),v):null},now:function(){return this.relativeTime},modified:function(){return this.getEntitiesMeta().list.keySet()},loadInbounds:function(h){var q,v=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),
b.toString((null!=(q=h.meta)?q:b.throwNPE()).latestPersisted)+"/"+h.path()+"#");null!=v&&(h.internal_inboundReferences=a.org.kevoree.modeling.api.time.blob.MetaHelper.unserialize(v,this))},"delete":function(){for(var b=this.getEntitiesMeta().list.keySet().iterator();b.hasNext();){var q=b.next(),v=this.getTimeTree(q);v.versionTree["delete"](this.relativeTime);v.dirty=!0;this.elementsToBeRemoved.add_za3rmp$(q)}this.getEntitiesMeta().list.clear();this.getEntitiesMeta().isDirty=!0;this.dirty||(b=this.getTimeTree(a.org.kevoree.modeling.api.time.TimeSegmentConst.GLOBAL_TIMEMETA),
null==b.versionTree.lookup(this.relativeTime)&&(b.versionTree.insert(this.relativeTime,a.org.kevoree.modeling.api.time.blob.STATE.object.EXISTS),b.dirty=!0));b=this.getEntitiesMeta();b.list.clear();b.isDirty=!0},diff:function(h){var q=new a.org.kevoree.modeling.api.trace.TraceSequence(this),v=this.getTimeTree(a.org.kevoree.modeling.api.time.TimeSegmentConst.GLOBAL_TIMEMETA),y,w,u=null!=(y=v.versionTree.previousOrEqual(this.relativeTime))?y.key:null;y=null!=(w=v.versionTree.previousOrEqual(h.relativeTime))?
w.key:null;if(null==u||null==y)return q;1<a.org.kevoree.modeling.api.time.TimeComparator.compare(null!=u?u:b.throwNPE(),null!=y?y:b.throwNPE())&&(w=u,u=y,y=w);for(u=null!=u?u:b.throwNPE();!b.equals(u,null!=y?y:b.throwNPE());){for(w=h.getEntitiesMeta().list.keySet().iterator();w.hasNext();){var r=w.next(),r=u.toString()+"/"+r,r=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),r);null!=r&&q.populateFromString(r)}var t,n,u=null!=(n=null!=(t=v.versionTree.next(u))?t.key:
null)?n:b.throwNPE()}return q}}),TimeTree:b.createTrait(null),TimeWalker:b.createTrait(null)}),TransactionManager:b.createTrait(null),Transaction:b.createTrait(null),TimeTransaction:b.createTrait(function(){return[a.org.kevoree.modeling.api.Transaction]}),Callback:b.createTrait(null),TimedContainer:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFContainer]},{now:{get:function(){return this.$now_2vpa82$},set:function(a){this.$now_2vpa82$=a}}}),ModelSerializer:b.createTrait(null),ModelPruner:b.createClass(null,
function(a){this.factory=a},{prune:function(h){var q=new b.ArrayList,v=new b.PrimitiveHashMap,y=new b.PrimitiveHashMap;for(h=h.iterator();h.hasNext();){var w=h.next();this.internal_prune(w,q,v,y)}for(y=v.keySet().iterator();y.hasNext();){h=y.next();var u;h=null!=(u=v.get_za3rmp$(h))?u:b.throwNPE();q.addAll_xeylzf$(h.toTraces(!1,!0))}return(new a.org.kevoree.modeling.api.trace.TraceSequence(this.factory)).populate(q)},internal_prune:function(h,q,v,y){for(var w=new b.ArrayList,u=h.eContainer();null!=
u&&null==y.get_za3rmp$((null!=u?u:b.throwNPE()).path())&&null==v.get_za3rmp$((null!=u?u:b.throwNPE()).path());)w.add_za3rmp$(null!=u?u:b.throwNPE()),u=(null!=u?u:b.throwNPE()).eContainer();for(w=a.kotlin.reverse_h3panj$(w).iterator();w.hasNext();){u=w.next();if(null!=u.eContainer()){var r,t;q.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace((null!=(r=u.eContainer())?r:b.throwNPE()).path(),null!=(t=u.getRefInParent())?t:b.throwNPE(),u.path(),u.metaClassName()))}q.addAll_xeylzf$(u.toTraces(!0,
!1));y.put_wn2jw4$(u.path(),u)}if(null==v.get_za3rmp$(h.path())&&null==y.get_za3rmp$(h.path())){if(null!=h.eContainer()){var n,s;q.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace((null!=(n=h.eContainer())?n:b.throwNPE()).path(),null!=(s=h.getRefInParent())?s:b.throwNPE(),h.path(),h.metaClassName()))}q.addAll_xeylzf$(h.toTraces(!0,!1))}v.put_wn2jw4$(h.path(),h);h.visitReferences(a.org.kevoree.modeling.api.ModelPruner.internal_prune$f(v,this,q,y))}},{internal_prune$f:function(h,q,v,y){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},
function u(){u.baseInitializer.call(this)},{visit:function(a,b,t){null==h.get_za3rmp$(a.path())&&q.internal_prune(a,v,h,y)}})}}),ModelCloner:b.createClass(null,function(a){this.factory=a},{createContext:function(){return new a.java.util.IdentityHashMap},clone:function(a){return this.clone_1(a,!1)},clone_1:function(a,b){return this.clone_2(a,b,!1)},cloneMutableOnly:function(a,b){return this.clone_2(a,b,!0)},cloneModelElem:function(h){var q,v=null!=(q=this.factory.create(h.metaClassName()))?q:b.throwNPE();
q=a.org.kevoree.modeling.api.ModelCloner.cloneModelElem$f(v);h.visitAttributes(q);return v},resolveModelElem:function(b,q,v,y){q=a.org.kevoree.modeling.api.ModelCloner.resolveModelElem$f(y,q,v);b.visit(q,!1,!0,!0)},clone_2:function(b,q,v){var y=this.createContext(),w=this.cloneModelElem(b);y.put_wn2jw4$(b,w);var u=a.org.kevoree.modeling.api.ModelCloner.clone_2$f(v,y,this);b.visit(u,!0,!0,!1);u=a.org.kevoree.modeling.api.ModelCloner.clone_2$f_0(v,y,this,q);this.resolveModelElem(b,w,y,v);b.visit(u,
!0,!0,!1);q&&w.setInternalReadOnly();b.isRoot()&&this.factory.root(w);return w}},{cloneModelElem$f:function(h){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(q,v,y){null!=q&&(b.isType(q,b.ArrayList)?(y=new b.ArrayList,y.addAll_xeylzf$(null!=q?q:b.throwNPE()),h.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,v,y,!1,!1)):h.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,v,q,!1,!1))}})},
resolveModelElem$f:function(h,q,v){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function w(){w.baseInitializer.call(this)},{visit:function(b,u,r){if(h&&b.isRecursiveReadOnly())q.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,u,b,!1,!1);else{r=v.get_za3rmp$(b);if(null==r)throw Error("Cloner error, not self-contain model, the element "+b.path()+" is contained in the root element");q.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,
u,r,!1,!1)}}})},clone_2$f:function(h,q,v){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function w(){w.baseInitializer.call(this)},{visit:function(a,b,r){h&&a.isRecursiveReadOnly()?this.noChildrenVisit():q.put_wn2jw4$(a,v.cloneModelElem(a))}})},clone_2$f_0:function(h,q,v,y){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function u(){u.baseInitializer.call(this)},{visit:function(a,r,t){if(!h||!a.isRecursiveReadOnly()){var n;
r=null!=(n=q.get_za3rmp$(a))?n:b.throwNPE();v.resolveModelElem(a,r,q,h);y&&r.setInternalReadOnly()}}})}}),KMFContainer:b.createTrait(null),ModelLoader:b.createTrait(null),KMFFactory:b.createTrait(null),xmi:b.definePackage(function(){this.Token=b.createObject(null,function(){this.XML_HEADER=0;this.END_DOCUMENT=1;this.START_TAG=2;this.END_TAG=3;this.COMMENT=4;this.SINGLETON_TAG=5})},{ResourceSet:b.createClass(null,function(){this.resources_twji9r$=new b.PrimitiveHashMap;this.invertedResources_583d58$=
new b.ComplexHashMap},{registerXmiAddrMappedObjects:function(h,q){this.resources_twji9r$.put_wn2jw4$(h,q);for(var v=a.kotlin.iterator_s8ckw1$(q);v.hasNext();){var y=v.next();if(this.invertedResources_583d58$.containsKey_za3rmp$(a.kotlin.get_value(y))){var w=this.invertedResources_583d58$.get_za3rmp$(a.kotlin.get_value(y));(null!=w?w:b.throwNPE()).addr.contains("@")&&this.invertedResources_583d58$.put_wn2jw4$(a.kotlin.get_value(y),new a.org.kevoree.modeling.api.xmi.XmiObjAddr(h,a.kotlin.get_key(y)))}else this.invertedResources_583d58$.put_wn2jw4$(a.kotlin.get_value(y),
new a.org.kevoree.modeling.api.xmi.XmiObjAddr(h,a.kotlin.get_key(y)))}},resolveObject:function(a){a=b.splitString(a," ");if(1<a.length){var q=b.splitString(a[1],"#");if(2===q.length)return a=this.resources_twji9r$.get_za3rmp$(q[0]),q=q[1],q=("#"+q).replace("#//","/0/"),null!=a?a.get_za3rmp$(q):null}return null},objToAddr:function(a){var b=this.invertedResources_583d58$.get_za3rmp$(a);if(null!=b){a=this.formatMetaClassName(a.metaClassName());var v=b.nsuri,b=b.addr,b=b.replace("/0/","#//");return a+
" "+v+b}return null},formatMetaClassName:function(b){var q=a.js.lastIndexOf_960177$(b,"."),v=b.substring(0,q);b=b.substring(q+1);return v+":"+b}}),XmiObjAddr:b.createClass(null,function(a,b){this.nsuri=a;this.addr=b},{component1:function(){return this.nsuri},component2:function(){return this.addr},copy:function(b,q){return new a.org.kevoree.modeling.api.xmi.XmiObjAddr(void 0===b?this.nsuri:b,void 0===q?this.addr:q)},toString:function(){return"XmiObjAddr(nsuri\x3d"+b.toString(this.nsuri)+(", addr\x3d"+
b.toString(this.addr))+")"},hashCode:function(){var a;a=30294374001+b.hashCode(this.nsuri)|0;return a=31*a+b.hashCode(this.addr)|0},equals_za3rmp$:function(a){return this===a||null!==a&&Object.getPrototypeOf(this)===Object.getPrototypeOf(a)&&b.equals(this.nsuri,a.nsuri)&&b.equals(this.addr,a.addr)}}),XmlParser:b.createClass(null,function(a){this.inputStream=a;this.bytes_gdnk4p$=this.inputStream.readBytes();this.index_gharkg$=-1;this.xmlCharset_tph6x5$=this.xmlVersion_ywy43n$=this.currentChar_x9b225$=
null;this.tagName_b61wcj$="";this.tagPrefix=null;this.attributesNames_b5o00h$=new b.ArrayList;this.attributesPrefixes_hgbl8n$=new b.ArrayList;this.attributesValues_d28x97$=new b.ArrayList;this.attributeName_f9qnph$=new b.StringBuilder;this.attributePrefix_r6drlg$=null;this.attributeValue_npfmfd$=new b.StringBuilder;this.readSingleton_h1okvh$=!1},{hasNext:function(){return 2<this.bytes_gdnk4p$.length-this.index_gharkg$},getLocalName:function(){return this.tagName_b61wcj$},getAttributeCount:function(){return this.attributesNames_b5o00h$.size()},
getAttributeLocalName:function(a){return this.attributesNames_b5o00h$.get_za3lpa$(a)},getAttributePrefix:function(a){return this.attributesPrefixes_hgbl8n$.get_za3lpa$(a)},getAttributeValue:function(a){return this.attributesValues_d28x97$.get_za3lpa$(a)},readChar:function(){return a.org.kevoree.modeling.api.util.ByteConverter.toChar(this.bytes_gdnk4p$[++this.index_gharkg$])},next:function(){if(this.readSingleton_h1okvh$)return this.readSingleton_h1okvh$=!1,a.org.kevoree.modeling.api.xmi.Token.END_TAG;
if(!this.hasNext())return a.org.kevoree.modeling.api.xmi.Token.END_DOCUMENT;this.attributesNames_b5o00h$.clear();this.attributesPrefixes_hgbl8n$.clear();this.attributesValues_d28x97$.clear();this.read_lessThan();this.currentChar_x9b225$=this.readChar();if("?"===this.currentChar_x9b225$)return this.currentChar_x9b225$=this.readChar(),this.read_xmlHeader(),a.org.kevoree.modeling.api.xmi.Token.XML_HEADER;if("!"===this.currentChar_x9b225$){do this.currentChar_x9b225$=this.readChar();while("\x3e"!==this.currentChar_x9b225$);
return a.org.kevoree.modeling.api.xmi.Token.COMMENT}if("/"===this.currentChar_x9b225$)return this.currentChar_x9b225$=this.readChar(),this.read_closingTag(),a.org.kevoree.modeling.api.xmi.Token.END_TAG;this.read_openTag();"/"===this.currentChar_x9b225$&&(this.read_upperThan(),this.readSingleton_h1okvh$=!0);return a.org.kevoree.modeling.api.xmi.Token.START_TAG},read_lessThan:function(){do this.currentChar_x9b225$=this.readChar();while("\x3c"!==this.currentChar_x9b225$)},read_upperThan:function(){for(;"\x3e"!==
this.currentChar_x9b225$;)this.currentChar_x9b225$=this.readChar()},read_xmlHeader:function(){this.read_tagName();this.read_attributes();this.read_upperThan()},read_closingTag:function(){this.read_tagName();this.read_upperThan()},read_openTag:function(){this.read_tagName();"\x3e"!==this.currentChar_x9b225$&&"/"!==this.currentChar_x9b225$&&this.read_attributes()},read_tagName:function(){this.tagName_b61wcj$=""+this.currentChar_x9b225$;this.tagPrefix=null;for(this.currentChar_x9b225$=this.readChar();" "!==
this.currentChar_x9b225$&&"\x3e"!==this.currentChar_x9b225$&&"/"!==this.currentChar_x9b225$;)":"===this.currentChar_x9b225$?(this.tagPrefix=this.tagName_b61wcj$,this.tagName_b61wcj$=""):this.tagName_b61wcj$+=this.currentChar_x9b225$,this.currentChar_x9b225$=this.readChar()},read_attributes:function(){for(var a=!1;" "===this.currentChar_x9b225$;)this.currentChar_x9b225$=this.readChar();for(;!a;){for(;"\x3d"!==this.currentChar_x9b225$;){if(":"===this.currentChar_x9b225$)this.attributePrefix_r6drlg$=
this.attributeName_f9qnph$.toString(),this.attributeName_f9qnph$=new b.StringBuilder;else{var q;this.attributeName_f9qnph$.append(null!=(q=this.currentChar_x9b225$)?q:b.throwNPE())}this.currentChar_x9b225$=this.readChar()}do this.currentChar_x9b225$=this.readChar();while('"'!==this.currentChar_x9b225$);for(this.currentChar_x9b225$=this.readChar();'"'!==this.currentChar_x9b225$;){var v;this.attributeValue_npfmfd$.append(null!=(v=this.currentChar_x9b225$)?v:b.throwNPE());this.currentChar_x9b225$=this.readChar()}this.attributesNames_b5o00h$.add_za3rmp$(this.attributeName_f9qnph$.toString());
this.attributesPrefixes_hgbl8n$.add_za3rmp$(this.attributePrefix_r6drlg$);this.attributesValues_d28x97$.add_za3rmp$(this.attributeValue_npfmfd$.toString());this.attributeName_f9qnph$=new b.StringBuilder;this.attributePrefix_r6drlg$=null;this.attributeValue_npfmfd$=new b.StringBuilder;do if(this.currentChar_x9b225$=this.readChar(),"?"===this.currentChar_x9b225$||"/"===this.currentChar_x9b225$||"-"===this.currentChar_x9b225$||"\x3e"===this.currentChar_x9b225$)a=!0;while(!a&&" "===this.currentChar_x9b225$)}}}),
XMIModelLoader:b.createClass(function(){return[a.org.kevoree.modeling.api.ModelLoader]},function(h){this.factory=h;this.resourceSet=null;this.LOADER_XMI_LOCAL_NAME="type";this.LOADER_XMI_XSI="xsi";this.LOADER_XMI_NS_URI="nsURI";this.attributesHashmap_7wijs5$=new b.PrimitiveHashMap;this.referencesHashmap_cc1kom$=new b.PrimitiveHashMap;this.namedElementSupportActivated_71goxr$=!1;this.attributeVisitor_g67dla$=a.org.kevoree.modeling.api.xmi.XMIModelLoader.XMIModelLoader$f(this);this.referencesVisitor_g5fzti$=
a.org.kevoree.modeling.api.xmi.XMIModelLoader.XMIModelLoader$f_0(this)},{activateSupportForNamedElements:function(a){this.namedElementSupportActivated_71goxr$=a},unescapeXml:function(a){for(var q=null,v=0;v<a.length;){var y=a.charAt(v);"\x26"===y?(null==q&&(q=new b.StringBuilder,(null!=q?q:b.throwNPE()).append(a.substring(0,v))),"a"===a.charAt(v+1)?"m"===a.charAt(v+2)?(null!=q?q.append("\x26"):null,v+=5):"p"===a.charAt(v+2)?(null!=q?q.append("'"):null,v+=6):b.println("Could not unescaped chain:"+
a.charAt(v)+a.charAt(v+1)+a.charAt(v+2)):"q"===a.charAt(v+1)?(null!=q?q.append('"'):null,v+=6):"l"===a.charAt(v+1)?(null!=q?q.append("\x3c"):null,v+=4):"g"===a.charAt(v+1)?(null!=q?q.append("\x3e"):null,v+=4):b.println("Could not unescaped chain:"+a.charAt(v)+a.charAt(v+1))):(null!=q&&(null!=q?q.append(y):null),v++)}return null!=q?b.toString(q):a},loadModelFromString:function(h){h=new a.org.kevoree.modeling.api.xmi.XmlParser(a.org.kevoree.modeling.api.util.ByteConverter.byteArrayInputStreamFromString(h));
if(h.hasNext())return this.deserialize(h);b.println("Loader::Nothing in the String !");return null},loadModelFromStream:function(h){h=new a.org.kevoree.modeling.api.xmi.XmlParser(h);if(h.hasNext())return this.deserialize(h);b.println("Loader::Nothing in the file !");return null},loadObject:function(h,q,v){void 0===v&&(v=null);var y,w,u,r,t,n=(null!=(y=h.xmiReader)?y:b.throwNPE()).getLocalName();if(null!=v){var s;v=null!=(s=this.factory)?s.create(v):null;if(null==v){s=null;var f,d;d=new b.NumberRange(0,
(null!=(f=h.xmiReader)?f:b.throwNPE()).getAttributeCount()-1);y=d.start;f=d.end;for(d=d.increment;y<=f;y+=d){var c,e=(null!=(t=h.xmiReader)?t:b.throwNPE()).getAttributeLocalName(y),g=(null!=(c=h.xmiReader)?c:b.throwNPE()).getAttributePrefix(y);if(b.equals(e,this.LOADER_XMI_LOCAL_NAME)&&b.equals(g,this.LOADER_XMI_XSI)){var k;s=(null!=(k=h.xmiReader)?k:b.throwNPE()).getAttributeValue(y);break}}if(null!=s){v=null!=s?s.substring(0,(null!=s?s:b.throwNPE()).lastIndexOf(":")):null;t=(null!=s?s:b.throwNPE()).substring((null!=
s?s:b.throwNPE()).lastIndexOf(":")+1,(null!=s?s:b.throwNPE()).length);var x;v=null!=(x=this.factory)?x.create(a.kotlin.plus_n7iowf$(v,".")+t):null}}}else v=null!=(d=this.factory)?d.create(n):null;null==v&&b.println("Could not create an object for local name "+n);h.map.put_wn2jw4$(q,null!=v?v:b.throwNPE());this.attributesHashmap_7wijs5$.containsKey_za3rmp$((null!=v?v:b.throwNPE()).metaClassName())||(null!=v?v.visitAttributes(this.attributeVisitor_g67dla$):null);x=null!=(w=this.attributesHashmap_7wijs5$.get_za3rmp$((null!=
v?v:b.throwNPE()).metaClassName()))?w:b.throwNPE();this.referencesHashmap_cc1kom$.containsKey_za3rmp$((null!=v?v:b.throwNPE()).metaClassName())||(null!=v?v.visit(this.referencesVisitor_g5fzti$,!1,!0,!1):null);w=null!=(u=this.referencesHashmap_cc1kom$.get_za3rmp$((null!=v?v:b.throwNPE()).metaClassName()))?u:b.throwNPE();u=new b.NumberRange(0,(null!=(r=h.xmiReader)?r:b.throwNPE()).getAttributeCount()-1);t=u.start;r=u.end;for(u=u.increment;t<=r;t+=u){var z;c=(null!=(z=h.xmiReader)?z:b.throwNPE()).getAttributePrefix(t);
if(null==c||b.equals(c,"")){var A,C;c=(null!=(A=h.xmiReader)?A:b.throwNPE()).getAttributeLocalName(t).trim();k=(null!=(C=h.xmiReader)?C:b.throwNPE()).getAttributeValue(t).trim();if(null!=k)if(x.containsKey_za3rmp$(c)){if(null!=v?v.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,c,this.unescapeXml(k),!1,!1):null,this.namedElementSupportActivated_71goxr$&&b.equals(c,"name"))for(c=h.map.get_za3rmp$(q.substring(0,q.lastIndexOf("/"))),s=a.kotlin.toList_h3panj$(h.map.entrySet()).iterator();s.hasNext();)f=
s.next(),b.equals(a.kotlin.get_value(f),c)&&(f=a.kotlin.get_key(f)+"/"+this.unescapeXml(k),h.map.put_wn2jw4$(f,null!=v?v:b.throwNPE()))}else if(k.startsWith("#")||k.startsWith("/"))for(k=b.splitString(k," "),s=k.length,f=0;f!==s;++f)d=k[f],d=d.startsWith("#")?d.substring(1):d,d=d.startsWith("//")?"/0"+d.substring(1):d,d=d.replace(".0",""),y=h.map.get_za3rmp$(d),null!=y?null!=v?v.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,c,y,!0,!1):null:h.resolvers.add_za3rmp$(new a.org.kevoree.modeling.api.xmi.XMIResolveCommand(h,
null!=v?v:b.throwNPE(),a.org.kevoree.modeling.api.util.ActionType.object.ADD,c,d,this.resourceSet));else if(null!=this.resourceSet){var E;s=(null!=(E=this.resourceSet)?E:b.throwNPE()).resolveObject(k);if(null!=s)null!=v?v.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,c,s,!0,!1):null;else throw Error("Unresolve NsURI based XMI reference "+k);}else throw Error("Bad XMI reference "+k);}}for(z=!1;!z;){var F;A=(null!=(F=h.xmiReader)?F:b.throwNPE()).next();if(A===a.org.kevoree.modeling.api.xmi.Token.START_TAG){var G,
H;A=(null!=(G=h.xmiReader)?G:b.throwNPE()).getLocalName();C=null!=(H=h.elementsCount.get_za3rmp$(q+"/@"+A))?H:0;E=this.loadObject(h,q+"/@"+A+(0!==C?"."+C:""),w.get_za3rmp$(A));null!=v?v.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,A,E,!0,!1):null;h.elementsCount.put_wn2jw4$(q+"/@"+A,C+1)}else if(A===a.org.kevoree.modeling.api.xmi.Token.END_TAG){var I;b.equals((null!=(I=h.xmiReader)?I:b.throwNPE()).getLocalName(),n)&&(z=!0)}}return null!=v?v:b.throwNPE()},deserialize:function(h){var q=
null,v=new a.org.kevoree.modeling.api.xmi.LoadingContext;for(v.xmiReader=h;h.hasNext();){var y=h.next();if(y===a.org.kevoree.modeling.api.xmi.Token.START_TAG)if(y=h.getLocalName(),null!=y){var w=v.loadedRoots.size(),u=new b.PrimitiveHashMap,r,t,n,s;t=new b.NumberRange(0,(null!=(r=v.xmiReader)?r:b.throwNPE()).getAttributeCount()-1);n=t.start;s=t.end;for(t=t.increment;n<=s;n+=t){var f,d,c=(null!=(f=v.xmiReader)?f:b.throwNPE()).getAttributeLocalName(n),e=(null!=(d=v.xmiReader)?d:b.throwNPE()).getAttributeValue(n);
b.equals(c,this.LOADER_XMI_NS_URI)&&(q=e);u.put_wn2jw4$(c,e)}s=h.tagPrefix;u.get_za3rmp$(s);v.loadedRoots.add_za3rmp$(this.loadObject(v,"/"+w,b.toString(s)+"."+y))}else b.println("Tried to read a tag with null tag_name.");else if(y===a.org.kevoree.modeling.api.xmi.Token.END_TAG)break;else if(y===a.org.kevoree.modeling.api.xmi.Token.END_DOCUMENT)break}for(h=v.resolvers.iterator();h.hasNext();)h.next().run();if(null!=this.resourceSet&&null!=q){var g;(null!=(g=this.resourceSet)?g:b.throwNPE()).registerXmiAddrMappedObjects(null!=
q?q:b.throwNPE(),v.map)}return v.loadedRoots}},{visit$f:function(){return new b.PrimitiveHashMap},XMIModelLoader$f:function(h){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(b,v,y){a.kotlin.getOrPut_ynyybx$(h.attributesHashmap_7wijs5$,y.metaClassName(),a.org.kevoree.modeling.api.xmi.XMIModelLoader.visit$f).put_wn2jw4$(v,!0)}})},beginVisitElem$f:function(){return new b.PrimitiveHashMap},XMIModelLoader$f_0:function(h){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},
function v(){v.baseInitializer.call(this);this.refMap=null},{beginVisitElem:function(b){this.refMap=a.kotlin.getOrPut_ynyybx$(h.referencesHashmap_cc1kom$,b.metaClassName(),a.org.kevoree.modeling.api.xmi.XMIModelLoader.beginVisitElem$f)},endVisitElem:function(a){this.refMap=null},beginVisitRef:function(a,h){var w;(null!=(w=this.refMap)?w:b.throwNPE()).put_wn2jw4$(a,h);return!0},visit:function(a,b,h){}})}}),LoadingContext:b.createClass(null,function(){this.xmiReader=null;this.loadedRoots=new b.ArrayList;
this.map=new b.PrimitiveHashMap;this.elementsCount=new b.PrimitiveHashMap;this.resolvers=new b.ArrayList;this.stats=new b.PrimitiveHashMap;this.oppositesAlreadySet=new b.PrimitiveHashMap},{isOppositeAlreadySet:function(a,b){return null!=this.oppositesAlreadySet.get_za3rmp$(b+"_"+a)||null!=this.oppositesAlreadySet.get_za3rmp$(a+"_"+b)},storeOppositeRelation:function(a,b){this.oppositesAlreadySet.put_wn2jw4$(a+"_"+b,!0)}}),XMIResolveCommand:b.createClass(null,function(a,b,v,y,w,u){this.context=a;this.target=
b;this.mutatorType=v;this.refName=y;this.ref=w;this.resourceSet=u},{run:function(){var a=this.context.map.get_za3rmp$(this.ref);if(null!=a)this.target.reflexiveMutator(this.mutatorType,this.refName,a,!0,!1);else{if(b.equals(this.ref,"/0/")||b.equals(this.ref,"/"))if(a=this.context.map.get_za3rmp$("/0"),null!=a){this.target.reflexiveMutator(this.mutatorType,this.refName,a,!0,!1);return}if(null!=this.resourceSet&&(a=this.resourceSet.resolveObject(this.ref),null!=a)){this.target.reflexiveMutator(this.mutatorType,
this.refName,a,!0,!1);return}throw Error("KMF Load error : reference "+this.ref+" not found in map when trying to  "+this.mutatorType+" "+this.refName+"  on "+this.target.metaClassName()+"(path:"+this.target.path()+")");}}}),ReferencesVisitor:b.createClass(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function q(a,b,w,u){q.baseInitializer.call(this);this.ostream=a;this.addressTable=b;this.elementsCount=w;this.resourceSet=u;this.value=null},{endVisitRef:function(a){null!=this.value&&
(this.ostream.print_4(" "+a+'\x3d"'+b.toString(this.value)+'"'),this.value=null)},visit:function(a,v,y){var w;v=null!=(w=this.resourceSet)?w.objToAddr(a):null;null==v&&(v=this.addressTable.get_za3rmp$(a));if(null==this.value)this.value=v;else{var u,r;this.value=(null!=(u=this.value)?u:b.throwNPE())+" ";this.value=(null!=(r=this.value)?r:b.throwNPE())+b.toString(v)}}}),AttributesVisitor:b.createClass(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},function(a,b){this.ostream=
a;this.ignoreGeneratedID=b},{visit:function(q,v,y){null==q||this.ignoreGeneratedID&&b.equals(v,"generated_KMF_ID")||"string"===typeof q&&b.equals(q,"")||(this.ostream.print_4(" "+v+'\x3d"'),b.isType(q,Date)?this.escapeXml(this.ostream,""+q.getTime()):this.escapeXml(this.ostream,a.org.kevoree.modeling.api.util.AttConverter.convFlatAtt(q)),this.ostream.print_4('"'))},escapeXml:function(a,b){if(null!=b)for(var y=0,w=b.length;y<w;){var u=b.charAt(y);'"'===u?a.print_4("\x26quot;"):"\x26"===u?a.print_4("\x26amp;"):
"'"===u?a.print_4("\x26apos;"):"\x3c"===u?a.print_4("\x26lt;"):"\x3e"===u?a.print_4("\x26gt;"):a.print_1(u);y+=1}}}),ModelSerializationVisitor:b.createClass(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function v(b,w,u,r,t){v.baseInitializer.call(this);this.ostream=b;this.addressTable=w;this.elementsCount=u;this.resourceSet=r;this.attributeVisitor=new a.org.kevoree.modeling.api.xmi.AttributesVisitor(this.ostream,t);this.referenceVisitor=new a.org.kevoree.modeling.api.xmi.ReferencesVisitor(this.ostream,
this.addressTable,this.elementsCount,this.resourceSet)},{visit:function(a,b,w){this.ostream.print_1("\x3c");this.ostream.print_4(b);this.ostream.print_4(' xsi:type\x3d"'+this.formatMetaClassName(a.metaClassName())+'"');a.visitAttributes(this.attributeVisitor);a.visit(this.referenceVisitor,!1,!1,!0);this.ostream.println_1("\x3e");a.visit(this,!1,!0,!1);this.ostream.print_4("\x3c/");this.ostream.print_4(b);this.ostream.print_1("\x3e");this.ostream.println()},formatMetaClassName:function(b){var y=a.js.lastIndexOf_960177$(b,
"."),w=b.substring(0,y);b=b.substring(y+1);return w+":"+b}}),ModelAddressVisitor:b.createClass(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function y(a,b,r){y.baseInitializer.call(this);this.addressTable=a;this.elementsCount=b;this.packageList=r},{visit:function(y,w,u){var r,t;u=null!=(r=this.addressTable.get_za3rmp$(u))?r:b.throwNPE();r=null!=(t=this.elementsCount.get_za3rmp$(u+"/@"+w))?t:0;this.addressTable.put_wn2jw4$(y,u+"/@"+w+"."+r);this.elementsCount.put_wn2jw4$(u+"/@"+
w,r+1);y=y.metaClassName().substring(0,a.js.lastIndexOf_960177$(y.metaClassName(),"."));this.packageList.contains_za3rmp$(y)||this.packageList.add_za3rmp$(y)}}),XMIModelSerializer:b.createClass(function(){return[a.org.kevoree.modeling.api.ModelSerializer]},function(){this.resourceSet=null;this.ignoreGeneratedID=!1},{serialize:function(b){var w=new a.java.io.ByteArrayOutputStream;this.serializeToStream(b,w);w.flush();return w.toString()},serializeToStream:function(y,w){var u=new a.java.io.PrintStream(new a.java.io.BufferedOutputStream(w),
!1),r=new b.ComplexHashMap,t=new b.ArrayList;r.put_wn2jw4$(y,"/");var n=new b.PrimitiveHashMap,s=new a.org.kevoree.modeling.api.xmi.ModelAddressVisitor(r,n,t);y.visit(s,!0,!0,!1);s=new a.org.kevoree.modeling.api.xmi.ModelSerializationVisitor(u,r,n,this.resourceSet,this.ignoreGeneratedID);u.println_2('\x3c?xml version\x3d"1.0" encoding\x3d"UTF-8"?\x3e');u.print_4("\x3c"+this.formatMetaClassName(y.metaClassName()).replace(".","_"));u.print_4(' xmlns:xsi\x3d"http://wwww.w3.org/2001/XMLSchema-instance"');
u.print_4(' xmi:version\x3d"2.0"');u.print_4(' xmlns:xmi\x3d"http://www.omg.org/XMI"');for(var f=0;f<a.kotlin.get_size_1(t);)u.print_4(" xmlns:"+t.get_za3lpa$(f).replace(".","_")+'\x3d"http://'+t.get_za3lpa$(f)+'"'),f++;y.visitAttributes(new a.org.kevoree.modeling.api.xmi.AttributesVisitor(u,this.ignoreGeneratedID));y.visit(new a.org.kevoree.modeling.api.xmi.ReferencesVisitor(u,r,n,this.resourceSet),!1,!1,!0);u.println_2("\x3e");y.visit(s,!1,!0,!1);u.println_2("\x3c/"+this.formatMetaClassName(y.metaClassName()).replace(".",
"_")+"\x3e");u.flush()},formatMetaClassName:function(b){var w=a.js.lastIndexOf_960177$(b,"."),u=b.substring(0,w);b=b.substring(w+1);return u+":"+b}})}),json:b.definePackage(function(){this.JSONString=b.createObject(null,function(){this.escapeChar_iwx5i$="\\"},{encodeBuffer:function(a,b){if(null!=b)for(var u=0;u<b.length;){var r=b.charAt(u);'"'===r?(a.append(this.escapeChar_iwx5i$),a.append('"')):r===this.escapeChar_iwx5i$?(a.append(this.escapeChar_iwx5i$),a.append(this.escapeChar_iwx5i$)):"\n"===
r?(a.append(this.escapeChar_iwx5i$),a.append("n")):"\r"===r?(a.append(this.escapeChar_iwx5i$),a.append("r")):"\t"===r?(a.append(this.escapeChar_iwx5i$),a.append("t")):"\u2028"===r?(a.append(this.escapeChar_iwx5i$),a.append("u"),a.append("2"),a.append("0"),a.append("2"),a.append("8")):"\u2029"===r?(a.append(this.escapeChar_iwx5i$),a.append("u"),a.append("2"),a.append("0"),a.append("2"),a.append("9")):a.append(r);u+=1}},encode:function(a,b){if(null!=b)for(var u=0;u<b.length;){var r=b.charAt(u);'"'===
r?(a.print_1(this.escapeChar_iwx5i$),a.print_1('"')):r===this.escapeChar_iwx5i$?(a.print_1(this.escapeChar_iwx5i$),a.print_1(this.escapeChar_iwx5i$)):"\n"===r?(a.print_1(this.escapeChar_iwx5i$),a.print_1("n")):"\r"===r?(a.print_1(this.escapeChar_iwx5i$),a.print_1("r")):"\t"===r?(a.print_1(this.escapeChar_iwx5i$),a.print_1("t")):"\u2028"===r?(a.print_1(this.escapeChar_iwx5i$),a.print_1("u"),a.print_1("2"),a.print_1("0"),a.print_1("2"),a.print_1("8")):"\u2029"===r?(a.print_1(this.escapeChar_iwx5i$),
a.print_1("u"),a.print_1("2"),a.print_1("0"),a.print_1("2"),a.print_1("9")):a.print_1(r);u+=1}},unescape:function(a){if(null==a)return null;if(0===a.length)return a;for(var w=null,u=0;u<a.length;){var r=a.charAt(u);if(r===this.escapeChar_iwx5i$)if(null==w&&(w=new b.StringBuilder,null!=w?w.append(a.substring(0,u)):null),u++,r=a.charAt(u),'"'===r)null!=w?w.append('"'):null;else if("\\"===r)null!=w?w.append(r):null;else if("/"===r)null!=w?w.append(r):null;else if("b"===r)null!=w?w.append("\b"):null;
else if("f"===r)null!=w?w.append((12).toChar()):null;else if("n"===r)null!=w?w.append("\n"):null;else if("r"===r)null!=w?w.append("\r"):null;else if("t"===r)null!=w?w.append("\t"):null;else{if("u"===r)throw Error("Bad char to escape ");}else null!=w&&(w=null!=w?w.append(r):null);u++}return null!=w?(null!=w?w:b.throwNPE()).toString():a}});this.Type=b.createObject(null,function(){this.VALUE=0;this.LEFT_BRACE=1;this.RIGHT_BRACE=2;this.LEFT_BRACKET=3;this.RIGHT_BRACKET=4;this.COMMA=5;this.COLON=6;this.EOF=
42})},{JSONModelLoader:b.createClass(function(){return[a.org.kevoree.modeling.api.ModelLoader]},function(a){this.factory=a},{loadModelFromString:function(b){return this.deserialize(a.org.kevoree.modeling.api.util.ByteConverter.byteArrayInputStreamFromString(b))},loadModelFromStream:function(a){return this.deserialize(a)},deserialize:function(y){if(null==y)throw Error("Null input Stream");var w=new b.ArrayList,u=new b.ArrayList;y=new a.org.kevoree.modeling.api.json.Lexer(y);if(y.nextToken().tokenType===
a.org.kevoree.modeling.api.json.Type.LEFT_BRACE)this.loadObject(y,null,null,u,w);else throw Error("Bad Format / {\u00a0expected");for(w=w.iterator();w.hasNext();)w.next().run();return u},loadObject:function(y,w,u,r,t){var n=y.nextToken(),s=null;if(n.tokenType===a.org.kevoree.modeling.api.json.Type.VALUE)if(b.equals(n.value,"class")){y.nextToken();var n=y.nextToken(),f,d,n=null!=(d=null!=(f=n.value)?f.toString():null)?d:b.throwNPE();f=null;d=!1;n.startsWith("root:")&&(d=!0,n=n.substring(5));n.contains("@")?
(f=n.substring(0,n.indexOf("@")),n=n.substring(n.indexOf("@")+1),null==u?d&&(s=this.factory.lookup("/")):(s=u.path()+"/"+w+"["+n+"]",s=this.factory.lookup(s))):f=n;null==s&&(s=this.factory.create(null!=f?f:b.throwNPE()));d&&this.factory.root(null!=s?s:b.throwNPE());null==u&&r.add_za3rmp$(null!=s?s:b.throwNPE());f=null;d=!1;for(n=y.nextToken();n.tokenType!==a.org.kevoree.modeling.api.json.Type.EOF;){n.tokenType===a.org.kevoree.modeling.api.json.Type.LEFT_BRACE&&this.loadObject(y,null!=f?f:b.throwNPE(),
s,r,t);if(n.tokenType===a.org.kevoree.modeling.api.json.Type.VALUE)if(null==f)f=b.toString(n.value);else if(d){var c;t.add_za3rmp$(new a.org.kevoree.modeling.api.json.ResolveCommand(r,(null!=(c=n.value)?c:b.throwNPE()).toString(),null!=s?s:b.throwNPE(),null!=f?f:b.throwNPE()))}else{var e=a.org.kevoree.modeling.api.json.JSONString.unescape(b.toString(n.value));(null!=s?s:b.throwNPE()).reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,null!=f?f:b.throwNPE(),e,!1,!1);f=null}if(n.tokenType===
a.org.kevoree.modeling.api.json.Type.LEFT_BRACKET)if(n=y.nextToken(),n.tokenType===a.org.kevoree.modeling.api.json.Type.LEFT_BRACE)this.loadObject(y,null!=f?f:b.throwNPE(),s,r,t);else if(d=!0,n.tokenType===a.org.kevoree.modeling.api.json.Type.VALUE){var g;t.add_za3rmp$(new a.org.kevoree.modeling.api.json.ResolveCommand(r,(null!=(g=n.value)?g:b.throwNPE()).toString(),null!=s?s:b.throwNPE(),null!=f?f:b.throwNPE()))}n.tokenType===a.org.kevoree.modeling.api.json.Type.RIGHT_BRACKET&&(f=null,d=!1);if(n.tokenType===
a.org.kevoree.modeling.api.json.Type.RIGHT_BRACE){null!=u&&u.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,null!=w?w:b.throwNPE(),s,!1,!1);break}n=y.nextToken()}}else throw Error("Bad Format / eClass att must be first");else throw Error("Bad Format");}}),ResolveCommand:b.createClass(null,function(a,b,u,r){this.roots=a;this.ref=b;this.currentRootElem=u;this.refName=r},{run:function(){for(var b=null,w=0;null==b&&w<this.roots.size();)b=this.roots.get_za3lpa$(w++).findByPath(this.ref);
if(null!=b)this.currentRootElem.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,this.refName,b,!1,!1);else throw Error("Unresolved "+this.ref);}}),Token:b.createClass(null,function(a,b){this.tokenType=a;this.value=b},{toString:function(){return this.tokenType.toString()+(null!=this.value?" ("+this.value+")":"")}}),Lexer:b.createClass(null,function(b){this.inputStream=b;this.bytes=this.inputStream.readBytes();this.EOF=new a.org.kevoree.modeling.api.json.Token(a.org.kevoree.modeling.api.json.Type.EOF,
null);this.index=0;this.DIGIT=this.BOOLEAN_LETTERS=null},{isSpace:function(a){return" "===a||"\r"===a||"\n"===a||"\t"===a},nextChar:function(){return a.org.kevoree.modeling.api.util.ByteConverter.toChar(this.bytes[this.index++])},peekChar:function(){return a.org.kevoree.modeling.api.util.ByteConverter.toChar(this.bytes[this.index])},isDone:function(){return this.index>=this.bytes.length},isBooleanLetter:function(a){if(null==this.BOOLEAN_LETTERS){this.BOOLEAN_LETTERS=new b.PrimitiveHashSet;var w,u,
r,t,n,s,f,d;(null!=(w=this.BOOLEAN_LETTERS)?w:b.throwNPE()).add_za3rmp$("f");(null!=(u=this.BOOLEAN_LETTERS)?u:b.throwNPE()).add_za3rmp$("a");(null!=(r=this.BOOLEAN_LETTERS)?r:b.throwNPE()).add_za3rmp$("l");(null!=(t=this.BOOLEAN_LETTERS)?t:b.throwNPE()).add_za3rmp$("s");(null!=(n=this.BOOLEAN_LETTERS)?n:b.throwNPE()).add_za3rmp$("e");(null!=(s=this.BOOLEAN_LETTERS)?s:b.throwNPE()).add_za3rmp$("t");(null!=(f=this.BOOLEAN_LETTERS)?f:b.throwNPE()).add_za3rmp$("r");(null!=(d=this.BOOLEAN_LETTERS)?d:
b.throwNPE()).add_za3rmp$("u")}var c;return(null!=(c=this.BOOLEAN_LETTERS)?c:b.throwNPE()).contains_za3rmp$(a)},isDigit:function(a){if(null==this.DIGIT){this.DIGIT=new b.PrimitiveHashSet;var w,u,r,t,n,s,f,d,c,e;(null!=(w=this.DIGIT)?w:b.throwNPE()).add_za3rmp$("0");(null!=(u=this.DIGIT)?u:b.throwNPE()).add_za3rmp$("1");(null!=(r=this.DIGIT)?r:b.throwNPE()).add_za3rmp$("2");(null!=(t=this.DIGIT)?t:b.throwNPE()).add_za3rmp$("3");(null!=(n=this.DIGIT)?n:b.throwNPE()).add_za3rmp$("4");(null!=(s=this.DIGIT)?
s:b.throwNPE()).add_za3rmp$("5");(null!=(f=this.DIGIT)?f:b.throwNPE()).add_za3rmp$("6");(null!=(d=this.DIGIT)?d:b.throwNPE()).add_za3rmp$("7");(null!=(c=this.DIGIT)?c:b.throwNPE()).add_za3rmp$("8");(null!=(e=this.DIGIT)?e:b.throwNPE()).add_za3rmp$("9")}var g;return(null!=(g=this.DIGIT)?g:b.throwNPE()).contains_za3rmp$(a)},isValueLetter:function(a){return"-"===a||"+"===a||"."===a||this.isDigit(a)||this.isBooleanLetter(a)},nextToken:function(){if(this.isDone())return this.EOF;for(var y=a.org.kevoree.modeling.api.json.Type.EOF,
w=this.nextChar(),u=new b.StringBuilder,r=null;!this.isDone()&&this.isSpace(w);)w=this.nextChar();if('"'===w){y=a.org.kevoree.modeling.api.json.Type.VALUE;if(this.isDone())throw new b.RuntimeException("Unterminated string");for(w=this.nextChar();this.index<this.bytes.length&&'"'!==w;)u.append(w),"\\"===w&&this.index<this.bytes.length&&(w=this.nextChar(),u.append(w)),w=this.nextChar();r=u.toString()}else if("{"===w)y=a.org.kevoree.modeling.api.json.Type.LEFT_BRACE;else if("}"===w)y=a.org.kevoree.modeling.api.json.Type.RIGHT_BRACE;
else if("["===w)y=a.org.kevoree.modeling.api.json.Type.LEFT_BRACKET;else if("]"===w)y=a.org.kevoree.modeling.api.json.Type.RIGHT_BRACKET;else if(":"===w)y=a.org.kevoree.modeling.api.json.Type.COLON;else if(","===w)y=a.org.kevoree.modeling.api.json.Type.COMMA;else if(this.isDone())y=a.org.kevoree.modeling.api.json.Type.EOF;else{for(;this.isValueLetter(w);)if(u.append(w),this.isValueLetter(this.peekChar()))w=this.nextChar();else break;y=u.toString();r=b.equals("true",y.toLowerCase())?!0:b.equals("false",
y.toLowerCase())?!1:y.toLowerCase();y=a.org.kevoree.modeling.api.json.Type.VALUE}return new a.org.kevoree.modeling.api.json.Token(y,r)}}),ModelReferenceVisitor:b.createClass(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function w(a){w.baseInitializer.call(this);this.out=a;this.isFirst=!0},{beginVisitRef:function(a,b){this.out.print_4(',"'+a+'":[');return this.isFirst=!0},endVisitRef:function(a){this.out.print_4("]")},visit:function(a,b,r){this.isFirst?this.isFirst=!1:this.out.print_4(",");
this.out.print_4('"'+a.path()+'"')}}),JSONModelSerializer:b.createClass(function(){return[a.org.kevoree.modeling.api.ModelSerializer]},null,{serialize:function(b){var u=new a.java.io.ByteArrayOutputStream;this.serializeToStream(b,u);u.close();return u.toString()},serializeToStream:function(b,u){var r=new a.java.io.PrintStream(new a.java.io.BufferedOutputStream(u),!1),t=new a.org.kevoree.modeling.api.json.ModelReferenceVisitor(r),t=a.org.kevoree.modeling.api.json.JSONModelSerializer.serializeToStream$f(r,
this,t);b.visit(t,!0,!0,!1);r.flush()},printAttName:function(w,u){var r="";b.equals(w.path(),"/")&&(r="root:");u.print_4('\n{"class":"'+r+w.metaClassName()+"@"+w.internalGetKey()+'"');r=a.org.kevoree.modeling.api.json.JSONModelSerializer.printAttName$f(u);w.visitAttributes(r)}},{serializeToStream$f:function(w,u,r){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function n(){n.baseInitializer.call(this);this.isFirstInRef=!0},{beginVisitElem:function(a){this.isFirstInRef||
(w.print_4(","),this.isFirstInRef=!1);u.printAttName(a,w);var b;null!=(b=r.alreadyVisited)?b.clear():null;a.visit(r,!1,!1,!0)},endVisitElem:function(a){w.println_2("}");this.isFirstInRef=!1},beginVisitRef:function(a,b){w.print_4(',"'+a+'":[');return this.isFirstInRef=!0},endVisitRef:function(a){w.print_4("]");this.isFirstInRef=!1},visit:function(a,b,f){}})},printAttName$f:function(w){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(u,
r,t){null!=u&&(w.print_4(',"'+r+'":"'),b.isType(u,Date)?a.org.kevoree.modeling.api.json.JSONString.encode(w,""+u.getTime()):a.org.kevoree.modeling.api.json.JSONString.encode(w,a.org.kevoree.modeling.api.util.AttConverter.convFlatAtt(u)),w.print_4('"'))}})}})}),persistence:b.definePackage(null,{DataStore:b.createTrait(null),KMFContainerProxy:b.createTrait(function(){return[a.org.kevoree.modeling.api.KMFContainer]},{isResolved:{get:function(){return this.$isResolved_q9gcci$},set:function(a){this.$isResolved_q9gcci$=
a}},inResolution:{get:function(){return this.$inResolution_fvhr0z$},set:function(a){this.$inResolution_fvhr0z$=a}},isDirty:{get:function(){return this.$isDirty_z1d6gk$},set:function(a){this.$isDirty_z1d6gk$=a}},originFactory:{get:function(){return this.$originFactory_8fzws8$},set:function(a){this.$originFactory_8fzws8$=a}},relativeLookupFrom:function(a,u,r){a=a.path();if(b.equals(a,"/")){var t;return null!=(t=this.originFactory)?t.lookup("/"+u+"["+r+"]"):null}var n;return null!=(n=this.originFactory)?
n.lookup(a+"/"+u+"["+r+"]"):null}}),PersistenceKMFFactory:b.createTrait(function(){return[a.org.kevoree.modeling.api.events.ModelElementListener,a.org.kevoree.modeling.api.KMFFactory]},{datastore:{get:function(){return this.$datastore_xkqfe9$}},dirty:{get:function(){return this.$dirty_e66hhy$},set:function(a){this.$dirty_e66hhy$=a}},originTransaction:{get:function(){return this.$originTransaction_kdsx68$}},remove:function(w){this.datastore.remove(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),
w.path());this.datastore.remove("type",w.path());this.elem_cache.remove_za3rmp$(w.path());this.modified_elements.remove_za3rmp$(b.hashCode(w).toString()+w.internalGetKey())},elem_cache:{get:function(){return this.$elem_cache_55i3ba$}},elementsToBeRemoved:{get:function(){return this.$elementsToBeRemoved_qnzocd$}},modified_elements:{get:function(){return this.$modified_elements_qtc91h$}},notify:function(w){if(null!=w.internalGetKey()){var u=b.hashCode(w).toString()+w.internalGetKey();null==this.modified_elements.get_za3rmp$(u)&&
this.modified_elements.put_wn2jw4$(u,w);w.path().startsWith("/")&&this.elem_cache.put_wn2jw4$(w.path(),w)}b.isType(w,a.org.kevoree.modeling.api.persistence.KMFContainerProxy)&&!w.isDirty&&(w.isDirty=!0)},cleanUnusedPaths:function(b){this.datastore.remove(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),b);this.datastore.remove("type",b);this.elem_cache.remove_za3rmp$(b)},persist:function(w){if(!b.isType(w,a.org.kevoree.modeling.api.persistence.KMFContainerProxy)||w.isDirty){var u=w.path();
if(b.equals(u,""))throw Error("Internal error, empty path found during persist method "+w);if(!u.startsWith("/"))throw Error("Cannot persist, because the path of the element do not refer to a root: "+u+" -\x3e "+w);var r=w.toTraces(!0,!0),t=new a.org.kevoree.modeling.api.trace.TraceSequence(this);t.populate(r);this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),u,t.exportToString());r=a.org.kevoree.modeling.api.time.blob.MetaHelper.serialize(w.internal_inboundReferences);
this.datastore.put(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),u+"#",r);this.datastore.put("type",u,w.metaClassName());b.isType(w,a.org.kevoree.modeling.api.persistence.KMFContainerProxy)&&(w.originFactory=this)}},endCommit:function(){this.datastore.commit()},commit:function(){if(this.dirty){for(var w=a.kotlin.toList_h3panj$(this.modified_elements.keySet()).iterator();w.hasNext();){var u=w.next(),r=this.modified_elements.get_za3rmp$(u);null==r||r.path().startsWith("/")||(r.isDeleted()||
r["delete"](),this.modified_elements.remove_za3rmp$(u))}for(w=this.modified_elements.keySet().iterator();w.hasNext();){var u=w.next(),t,u=null!=(t=this.modified_elements.get_za3rmp$(u))?t:b.throwNPE();this.persist(u);this.elementsToBeRemoved.remove_za3rmp$(u.path())}for(t=this.elementsToBeRemoved.iterator();t.hasNext();)w=t.next(),this.cleanUnusedPaths(w)}},clear:function(){for(var a=this.elem_cache.keySet().iterator();a.hasNext();){var u=a.next(),r;(null!=(r=this.elem_cache.get_za3rmp$(u))?r:b.throwNPE()).removeModelElementListener(this)}this.elem_cache.clear();
this.modified_elements.clear();this.elementsToBeRemoved.clear()},elementChanged:function(a){var u;(null!=(u=a.source)?u:b.throwNPE()).isDirty=!0;this.notify(a.source)},monitor:function(a){this.dirty||(this.dirty=!0);a.addModelElementListener(this)},lookup:function(a){if(b.equals(a,""))return null;if(this.elem_cache.containsKey_za3rmp$(a))return this.elem_cache.get_za3rmp$(a);var u=this.datastore.get("type",a);if(null!=u){var r,u=null!=(r=this.create(u))?r:b.throwNPE();this.elem_cache.put_wn2jw4$(a,
u);u.isResolved=!1;u.setOriginPath(a);this.monitor(u);return u}return null},getTraces:function(b){var u=new a.org.kevoree.modeling.api.trace.TraceSequence(this);b=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),b.path());return null!=b?(u.populateFromString(b),u):null},loadInbounds:function(b){var u=this.datastore.get(a.org.kevoree.modeling.api.time.TimeSegment.object.RAW.name(),b.path()+"#");null!=u&&(b.internal_inboundReferences=a.org.kevoree.modeling.api.time.blob.MetaHelper.unserialize(u,
this))},select:function(a){var u=this.lookup("/");return null!=u&&b.equals(a,"/")?(a=new b.ArrayList,a.add_za3rmp$(u),a):null!=u?u.select(a):new b.ArrayList}}),AbstractDataStore:b.createClass(function(){return[a.org.kevoree.modeling.api.persistence.DataStore]},function(){this.selector_6kse09$=new a.org.kevoree.modeling.api.persistence.EventDispatcher},{register:function(a,b,r,t){this.selector_6kse09$.register(a,b,r,t)},unregister:function(a){this.selector_6kse09$.unregister(a)},notify:function(a){this.selector_6kse09$.dispatch(a)}}),
EventDispatcher:b.createClass(null,function(){this.listeners_3hhuzx$=new b.ComplexHashMap},{register:function(b,u,r,t){this.listeners_3hhuzx$.put_wn2jw4$(b,new a.org.kevoree.modeling.api.persistence.TimedRegistration(u,r,t))},unregister:function(a){this.listeners_3hhuzx$.remove_za3rmp$(a)},dispatch:function(b){for(var u=a.kotlin.iterator_s8ckw1$(this.listeners_3hhuzx$);u.hasNext();){var r=u.next();a.kotlin.get_value(r).covered(b)&&a.kotlin.get_key(r).elementChanged(b)}},clear:function(){this.listeners_3hhuzx$.clear()}}),
TimedRegistration:b.createClass(null,function(a,b,r){this.from=a;this.to=b;this.pathRegex=r},{covered:function(w){if(b.isType(w.source,a.org.kevoree.modeling.api.time.TimeAwareKMFContainer)&&(null!=this.from&&this.from<w.source.now||null!=this.to&&this.to<w.source.now)||null==w.source)return!1;if(this.pathRegex.contains("*")){var u=this.pathRegex.replace("*",".*");return a.js.matches_94jgcu$(w.source.path(),u)}return b.equals(w.source.path(),this.pathRegex)},component1:function(){return this.from},
component2:function(){return this.to},component3:function(){return this.pathRegex},copy:function(b,u,r){return new a.org.kevoree.modeling.api.persistence.TimedRegistration(void 0===b?this.from:b,void 0===u?this.to:u,void 0===r?this.pathRegex:r)},toString:function(){return"TimedRegistration(from\x3d"+b.toString(this.from)+(", to\x3d"+b.toString(this.to))+(", pathRegex\x3d"+b.toString(this.pathRegex))+")"},hashCode:function(){var a;a=-17095736160+b.hashCode(this.from)|0;a=31*a+b.hashCode(this.to)|0;
return a=31*a+b.hashCode(this.pathRegex)|0},equals_za3rmp$:function(a){return this===a||null!==a&&Object.getPrototypeOf(this)===Object.getPrototypeOf(a)&&b.equals(this.from,a.from)&&b.equals(this.to,a.to)&&b.equals(this.pathRegex,a.pathRegex)}}),MemoryDataStore:b.createClass(function(){return[a.org.kevoree.modeling.api.persistence.DataStore]},function(){this.selector_38kq2e$=new a.org.kevoree.modeling.api.persistence.EventDispatcher;this.maps=new b.PrimitiveHashMap},{commit:function(){},register:function(a,
b,r,t){this.selector_38kq2e$.register(a,b,r,t)},unregister:function(a){this.selector_38kq2e$.unregister(a)},notify:function(a){this.selector_38kq2e$.dispatch(a)},getSegmentKeys:function(a){if(this.maps.containsKey_za3rmp$(a)){var u;(null!=(u=this.maps.get_za3rmp$(a))?u:b.throwNPE()).keySet()}return new b.PrimitiveHashSet},getSegments:function(){return this.maps.keySet()},close:function(){this.selector_38kq2e$.clear();this.maps.clear()},getOrCreateSegment:function(a){this.maps.containsKey_za3rmp$(a)||
this.maps.put_wn2jw4$(a,new b.PrimitiveHashMap);var u;return null!=(u=this.maps.get_za3rmp$(a))?u:b.throwNPE()},put:function(a,b,r){this.getOrCreateSegment(a).put_wn2jw4$(b,r)},get:function(a,b){return this.getOrCreateSegment(a).get_za3rmp$(b)},remove:function(a,b){this.getOrCreateSegment(a).remove_za3rmp$(b)},dump:function(){for(var w=a.kotlin.iterator_s8ckw1$(this.maps);w.hasNext();){var u=w.next();b.println("Map "+a.kotlin.get_key(u));for(u=a.kotlin.iterator_s8ckw1$(a.kotlin.get_value(u));u.hasNext();){var r=
u.next();b.println(a.kotlin.get_key(r)+"-\x3e"+a.kotlin.get_value(r))}}}})}),compare:b.definePackage(null,{ModelCompare:b.createClass(null,function(a){this.factory=a},{diff:function(b,u){return(new a.org.kevoree.modeling.api.trace.TraceSequence(this.factory)).populate(this.internal_diff(b,u,!1,!1))},merge:function(b,u){return(new a.org.kevoree.modeling.api.trace.TraceSequence(this.factory)).populate(this.internal_diff(b,u,!1,!0))},inter:function(b,u){return(new a.org.kevoree.modeling.api.trace.TraceSequence(this.factory)).populate(this.internal_diff(b,
u,!0,!1))},internal_diff:function(w,u,r,t){var n=new b.ArrayList,s=new b.ArrayList,f=new b.PrimitiveHashMap;n.addAll_xeylzf$(w.createTraces(u,r,t,!1,!0));s.addAll_xeylzf$(w.createTraces(u,r,t,!0,!1));var d=a.org.kevoree.modeling.api.compare.ModelCompare.internal_diff$f(f);w.visit(d,!0,!0,!1);w=a.org.kevoree.modeling.api.compare.ModelCompare.internal_diff$f_0(f,r,n,t,s);u.visit(w,!0,!0,!1);n.addAll_xeylzf$(s);if(!r&&!t)for(u=f.keySet().iterator();u.hasNext();){r=u.next();var c;r=null!=(c=f.get_za3rmp$(r))?
c:b.throwNPE();if(null!=r.eContainer()){var e;t=(null!=(e=r.eContainer())?e:b.throwNPE()).path()}else t="null";s=t;if(null!=r.getRefInParent()){var g;t=null!=(g=r.getRefInParent())?g:b.throwNPE()}else t="null";n.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveTrace(s,t,r.path()))}return n}},{internal_diff$f:function(w){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function r(){r.baseInitializer.call(this)},{visit:function(a,b,n){b=a.path();if(null!=
b)w.put_wn2jw4$(b,a);else throw Error("Null child path "+a);}})},internal_diff$f_0:function(w,u,r,t,n){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function f(){f.baseInitializer.call(this)},{visit:function(f,d,c){var e=f.path();if(w.containsKey_za3rmp$(e)){u&&r.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(c.path(),d,f.path(),f.metaClassName()));var g,k;r.addAll_xeylzf$((null!=(g=w.get_za3rmp$(e))?g:b.throwNPE()).createTraces(f,u,t,!1,!0));
n.addAll_xeylzf$((null!=(k=w.get_za3rmp$(e))?k:b.throwNPE()).createTraces(f,u,t,!0,!1));w.remove_za3rmp$(e)}else u||(r.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(c.path(),d,f.path(),f.metaClassName())),r.addAll_xeylzf$(f.createTraces(f,!0,t,!1,!0)),n.addAll_xeylzf$(f.createTraces(f,!0,t,!0,!1)))}})}})}),util:b.definePackage(function(){this.Selector=b.createObject(null,null,{select:function(w,u){var r=this.extractFirstQuery(u),t=new b.ArrayList,n={v:new b.PrimitiveHashMap};for(n.v.put_wn2jw4$(w.path(),
w);null!=r;){var r=null!=r?r:b.throwNPE(),s=n.v;n.v=new b.PrimitiveHashMap;for(var f=s.keySet().iterator();f.hasNext();){var d=f.next(),c,d=null!=(c=s.get_za3rmp$(d))?c:b.throwNPE(),e=null;r.oldString.contains("*")||(e=d.findByPath(r.oldString));null!=e?n.v.put_wn2jw4$((null!=e?e:b.throwNPE()).path(),null!=e?e:b.throwNPE()):(e={v:new b.PrimitiveHashMap},e=a.org.kevoree.modeling.api.util.select$f(r,e,n),r.previousIsDeep?d.visit(e,!1,!0,r.previousIsRefDeep):d.visit(e,!1,!0,!0))}r=null==r.subQuery?null:
this.extractFirstQuery(r.subQuery)}for(c=n.v.keySet().iterator();c.hasNext();){var r=c.next(),g;t.add_za3rmp$(null!=(g=n.v.get_za3rmp$(r))?g:b.throwNPE())}return t},extractFirstQuery:function(w){if("/"===w.charAt(0)){var u=null;1<w.length&&(u=w.substring(1));var r=new b.PrimitiveHashMap;return new a.org.kevoree.modeling.api.util.KmfQuery("",r,u,"/",!1,!1)}if(w.startsWith("**/"))return 3<w.length?(u=this.extractFirstQuery(w.substring(3)),null!=u&&(u.previousIsDeep=!0,u.previousIsRefDeep=!1),u):null;
if(w.startsWith("***/"))return 4<w.length?(u=this.extractFirstQuery(w.substring(4)),null!=u&&(u.previousIsDeep=!0,u.previousIsRefDeep=!0),u):null;for(var t=0,n=0,s=0,f=!1;t<w.length&&("/"!==w.charAt(t)||f);)f&&(f=!1),"["===w.charAt(t)?n=t:"]"===w.charAt(t)?s=t:"\\"===w.charAt(t)&&(f=!0),t+=1;if(0<t&&0<n){u=w.substring(0,t);r=null;t+1<w.length&&(r=w.substring(t+1));var t=w.substring(0,n),d=new b.PrimitiveHashMap,t=t.replace("\\","");if(0!==s){w=w.substring(n+1,s);s=n=0;for(f=!1;n<w.length;){if(","!==
w.charAt(n)||f)f="\\"===w.charAt(n)?!0:!1;else{var c=w.substring(s,n).trim();if(!b.equals(c,"")&&!b.equals(c,"*"))if(c.endsWith("\x3d")&&(c+="*"),s=b.splitString(c,"\x3d"),1<s.length){var c=s[0].trim(),e=c.endsWith("!"),s=new a.org.kevoree.modeling.api.util.KmfQueryParam(c.replace("!",""),s[1].trim(),a.kotlin.get_size(d),e),g;d.put_wn2jw4$(null!=(g=s.name)?g:b.throwNPE(),s)}else s=new a.org.kevoree.modeling.api.util.KmfQueryParam(null,c,a.kotlin.get_size(d),!1),d.put_wn2jw4$("@id",s);s=n+1}n+=1}g=
w.substring(s,n).trim();if(!b.equals(g,"")&&!b.equals(g,"*"))if(g.endsWith("\x3d")&&(g+="*"),f=b.splitString(g,"\x3d"),1<f.length){g=f[0].trim();w=g.endsWith("!");var f=new a.org.kevoree.modeling.api.util.KmfQueryParam(g.replace("!",""),f[1].trim(),a.kotlin.get_size(d),w),k;d.put_wn2jw4$(null!=(k=f.name)?k:b.throwNPE(),f)}else f=new a.org.kevoree.modeling.api.util.KmfQueryParam(null,g,a.kotlin.get_size(d),!1),d.put_wn2jw4$("@id",f)}return new a.org.kevoree.modeling.api.util.KmfQuery(t,d,r,u,!1,!1)}return null}});
this.ByteConverter=b.createObject(null,null,{toChar:function(a){return a},fromChar:function(a){return a},byteArrayInputStreamFromString:function(w){for(var u=b.numberArrayOfSize(w.length),r=0;r<w.length;)u[r]=w.charAt(r),r+=1;return new a.java.io.ByteArrayInputStream(u)}});this.AttConverter=b.createObject(null,null,{convFlatAtt:function(a){if(null==a)return null;if(b.isType(a,b.ArrayList)){var u=!0,r=new b.StringBuilder;for(a=a.iterator();a.hasNext();){var t=a.next();u||r.append("$");r.append(b.toString(t));
u=!1}return r.toString()}return a.toString()},convAttFlat:function(a){return b.splitString(a.toString(),"$")}});this.KevURLEncoder=b.createObject(null,function(){this.nonEscaped_rysd1l$=new b.PrimitiveHashMap;this.escaped_qojrqa$=new b.PrimitiveHashMap;this.rescaped_9ikhle$=new b.PrimitiveHashMap;for(var a="a";"z">a;)this.nonEscaped_rysd1l$.put_wn2jw4$(a,!0),a++;for(a="A";"Z">a;)this.nonEscaped_rysd1l$.put_wn2jw4$(a,!0),a++;for(a="0";"9">a;)this.nonEscaped_rysd1l$.put_wn2jw4$(a,!0),a++;this.escaped_qojrqa$.put_wn2jw4$("!",
"%21");this.escaped_qojrqa$.put_wn2jw4$('"',"%22");this.escaped_qojrqa$.put_wn2jw4$("#","%23");this.escaped_qojrqa$.put_wn2jw4$("$","%24");this.escaped_qojrqa$.put_wn2jw4$("%","%25");this.escaped_qojrqa$.put_wn2jw4$("\x26","%26");this.escaped_qojrqa$.put_wn2jw4$("*","%2A");this.escaped_qojrqa$.put_wn2jw4$(",","%2C");this.escaped_qojrqa$.put_wn2jw4$("/","%2F");this.escaped_qojrqa$.put_wn2jw4$("]","%5B");this.escaped_qojrqa$.put_wn2jw4$("\\","%5c");this.escaped_qojrqa$.put_wn2jw4$("[","%5D");for(a=
this.escaped_qojrqa$.keySet().iterator();a.hasNext();){var u=a.next(),r;this.rescaped_9ikhle$.put_wn2jw4$(null!=(r=this.escaped_qojrqa$.get_za3rmp$(u))?r:b.throwNPE(),u)}},{encode:function(w){if(null==w)return null;for(var u=null,r=0;r<w.length;){var t=w.charAt(r);a.kotlin.contains_6halgi$(this.nonEscaped_rysd1l$,t)?null!=u&&(null!=u?u:b.throwNPE()).append(t):(t=this.escaped_qojrqa$.get_za3rmp$(t),null!=t&&(null==u&&(u=new b.StringBuilder,(null!=u?u:b.throwNPE()).append(w.substring(0,r))),(null!=
u?u:b.throwNPE()).append(t)));r+=1}return null!=u?b.toString(u):w},decode:function(a){if(null==a)return null;if(0===a.length)return a;for(var u=null,r=0;r<a.length;){var t=a.charAt(r);if("%"===t){null==u&&(u=new b.StringBuilder,null!=u?u.append(a.substring(0,r)):null);var t=t.toString()+a.charAt(r+1)+a.charAt(r+2),n=this.rescaped_9ikhle$.get_za3rmp$(t),u=null==n?null!=u?u.append(t):null:null!=u?u.append(n):null,r=r+2}else null!=u&&(u=null!=u?u.append(t):null);r++}return null!=u?(null!=u?u:b.throwNPE()).toString():
a}})},{InboundRefAware:b.createTrait(null,{internal_inboundReferences:{get:function(){return this.$internal_inboundReferences_geftyz$},set:function(a){this.$internal_inboundReferences_geftyz$=a}}}),visit$f:function(a){return!1},visit$f_0:function(w,u){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelAttributeVisitor]},null,{visit:function(r,t,n){for(n=w.params.keySet().iterator();n.hasNext();){var s=n.next();if(b.equals(s,"@id"))throw Error("Malformed KMFQuery, bad selector attribute without attribute name : "+
w.params.get_za3rmp$(s));var f=!1;b.equals(s,t)?f=!0:s.contains("*")&&a.js.matches_94jgcu$(t,s.replace("*",".*"))&&(f=!0);var d,s=null!=(d=w.params.get_za3rmp$(s))?d:b.throwNPE();f&&(null==r?s.negative?b.equals(s.value,"null")||(u[s.idParam]=!0):b.equals(s.value,"null")&&(u[s.idParam]=!0):s.negative?s.value.contains("*")||b.equals(r,s.value)?a.js.matches_94jgcu$(r.toString(),s.value.replace("*",".*"))||(u[s.idParam]=!0):u[s.idParam]=!0:b.equals(r,s.value)?u[s.idParam]=!0:a.js.matches_94jgcu$(r.toString(),
s.value.replace("*",".*"))&&(u[s.idParam]=!0))}}})},select$f:function(w,u,r){return b.createObject(function(){return[a.org.kevoree.modeling.api.util.ModelVisitor]},function n(){n.baseInitializer.call(this)},{beginVisitRef:function(n,r){return w.previousIsDeep||b.equals(n,w.relationName)||w.relationName.contains("*")&&a.js.matches_94jgcu$(n,w.relationName.replace("*",".*"))?!0:!1},visit:function(n,s,f){if(!(w.previousIsRefDeep&&u.v.containsKey_za3rmp$(f.path()+"/"+s+"["+n.internalGetKey()+"]")||w.previousIsDeep&&
!w.previousIsRefDeep&&u.v.containsKey_za3rmp$(n.path()))){var d=!0;w.previousIsDeep&&(d=!1,b.equals(s,w.relationName)?d=!0:w.relationName.contains("*")&&a.js.matches_94jgcu$(s,w.relationName.replace("*",".*"))&&(d=!0));if(d){var c;if(1===a.kotlin.get_size(w.params)&&null!=w.params.get_za3rmp$("@id")&&null==(null!=(c=w.params.get_za3rmp$("@id"))?c:b.throwNPE()).name){var e;b.equals(n.internalGetKey(),null!=(e=w.params.get_za3rmp$("@id"))?e.value:null)&&r.v.put_wn2jw4$(n.path(),n)}else if(0<a.kotlin.get_size(w.params)){d=
b.arrayFromFun(a.kotlin.get_size(w.params),a.org.kevoree.modeling.api.util.visit$f);n.visitAttributes(a.org.kevoree.modeling.api.util.visit$f_0(w,d));c=!0;var g;e=d.length;for(g=0;g!==e;++g)d[g]||(c=!1);c&&r.v.put_wn2jw4$(n.path(),n)}else r.v.put_wn2jw4$(n.path(),n)}w.previousIsDeep&&(w.previousIsRefDeep?(u.v.put_wn2jw4$(f.path()+"/"+s+"["+n.internalGetKey()+"]",!0),n.visit(this,!1,!0,!0)):(u.v.put_wn2jw4$(n.path(),!0),n.visit(this,!1,!0,!1)))}}})},KmfQuery:b.createClass(null,function(a,b,r,t,n,s){this.relationName=
a;this.params=b;this.subQuery=r;this.oldString=t;this.previousIsDeep=n;this.previousIsRefDeep=s},{component1:function(){return this.relationName},component2:function(){return this.params},component3:function(){return this.subQuery},component4:function(){return this.oldString},component5:function(){return this.previousIsDeep},component6:function(){return this.previousIsRefDeep},copy:function(b,u,r,t,n,s){return new a.org.kevoree.modeling.api.util.KmfQuery(void 0===b?this.relationName:b,void 0===u?
this.params:u,void 0===r?this.subQuery:r,void 0===t?this.oldString:t,void 0===n?this.previousIsDeep:n,void 0===s?this.previousIsRefDeep:s)},toString:function(){return"KmfQuery(relationName\x3d"+b.toString(this.relationName)+(", params\x3d"+b.toString(this.params))+(", subQuery\x3d"+b.toString(this.subQuery))+(", oldString\x3d"+b.toString(this.oldString))+(", previousIsDeep\x3d"+b.toString(this.previousIsDeep))+(", previousIsRefDeep\x3d"+b.toString(this.previousIsRefDeep))+")"},hashCode:function(){var a;
a=-61600137231+b.hashCode(this.relationName)|0;a=31*a+b.hashCode(this.params)|0;a=31*a+b.hashCode(this.subQuery)|0;a=31*a+b.hashCode(this.oldString)|0;a=31*a+b.hashCode(this.previousIsDeep)|0;return a=31*a+b.hashCode(this.previousIsRefDeep)|0},equals_za3rmp$:function(a){return this===a||null!==a&&Object.getPrototypeOf(this)===Object.getPrototypeOf(a)&&b.equals(this.relationName,a.relationName)&&b.equals(this.params,a.params)&&b.equals(this.subQuery,a.subQuery)&&b.equals(this.oldString,a.oldString)&&
b.equals(this.previousIsDeep,a.previousIsDeep)&&b.equals(this.previousIsRefDeep,a.previousIsRefDeep)}}),KmfQueryParam:b.createClass(null,function(a,b,r,t){this.name=a;this.value=b;this.idParam=r;this.negative=t},{component1:function(){return this.name},component2:function(){return this.value},component3:function(){return this.idParam},component4:function(){return this.negative},copy:function(b,u,r,t){return new a.org.kevoree.modeling.api.util.KmfQueryParam(void 0===b?this.name:b,void 0===u?this.value:
u,void 0===r?this.idParam:r,void 0===t?this.negative:t)},toString:function(){return"KmfQueryParam(name\x3d"+b.toString(this.name)+(", value\x3d"+b.toString(this.value))+(", idParam\x3d"+b.toString(this.idParam))+(", negative\x3d"+b.toString(this.negative))+")"},hashCode:function(){var a;a=-27121503262+b.hashCode(this.name)|0;a=31*a+b.hashCode(this.value)|0;a=31*a+b.hashCode(this.idParam)|0;return a=31*a+b.hashCode(this.negative)|0},equals_za3rmp$:function(a){return this===a||null!==a&&Object.getPrototypeOf(this)===
Object.getPrototypeOf(a)&&b.equals(this.name,a.name)&&b.equals(this.value,a.value)&&b.equals(this.idParam,a.idParam)&&b.equals(this.negative,a.negative)}}),ModelAttributeVisitor:b.createTrait(null),ElementAttributeType:b.createClass(function(){return[b.Enum]},function u(){u.baseInitializer.call(this)},null,{object_initializer$:function(){return b.createEnumEntries({ATTRIBUTE:new a.org.kevoree.modeling.api.util.ElementAttributeType,REFERENCE:new a.org.kevoree.modeling.api.util.ElementAttributeType,
CONTAINMENT:new a.org.kevoree.modeling.api.util.ElementAttributeType})}}),ModelVisitor:b.createClass(null,function(){this.visitStopped=!1;this.visitReferences=this.visitChildren=!0;this.alreadyVisited=null},{stopVisit:function(){this.visitStopped=!0},noChildrenVisit:function(){this.visitChildren=!1},noReferencesVisit:function(){this.visitReferences=!1},beginVisitElem:function(a){},endVisitElem:function(a){},beginVisitRef:function(a,b){return!0},endVisitRef:function(a){}}),ActionType:b.createClass(function(){return[b.Enum]},
function r(a){r.baseInitializer.call(this);this.code=a},null,{object_initializer$:function(){return b.createEnumEntries({SET:new a.org.kevoree.modeling.api.util.ActionType("S"),ADD:new a.org.kevoree.modeling.api.util.ActionType("a"),REMOVE:new a.org.kevoree.modeling.api.util.ActionType("r"),ADD_ALL:new a.org.kevoree.modeling.api.util.ActionType("A"),REMOVE_ALL:new a.org.kevoree.modeling.api.util.ActionType("R"),RENEW_INDEX:new a.org.kevoree.modeling.api.util.ActionType("I"),CONTROL:new a.org.kevoree.modeling.api.util.ActionType("C")})}}),
ModelTracker:b.createClass(function(){return[a.org.kevoree.modeling.api.events.ModelElementListener]},function(b){this.compare=b;this.convertor=new a.org.kevoree.modeling.api.trace.Event2Trace(this.compare);this.traceSequence=this.invertedTraceSequence=this.currentModel=null;this.activated=!0},{elementChanged:function(a){if(this.activated){var t,n;(null!=(t=this.traceSequence)?t:b.throwNPE()).append(this.convertor.convert(a));(null!=(n=this.invertedTraceSequence)?n:b.throwNPE()).append(this.convertor.inverse(a))}},
track:function(r){this.currentModel=r;var t;(null!=(t=this.currentModel)?t:b.throwNPE()).addModelTreeListener(this);this.traceSequence=new a.org.kevoree.modeling.api.trace.TraceSequence(this.compare.factory);this.invertedTraceSequence=new a.org.kevoree.modeling.api.trace.TraceSequence(this.compare.factory)},untrack:function(){var a;null!=(a=this.currentModel)?a.removeModelTreeListener(this):null},redo:function(){if(null!=this.currentModel&&null!=this.traceSequence){this.activated=!1;try{var a,t;(null!=
(a=this.traceSequence)?a:b.throwNPE()).applyOn(null!=(t=this.currentModel)?t:b.throwNPE())}finally{this.activated=!0}}},undo:function(){if(null!=this.currentModel&&null!=this.invertedTraceSequence){this.activated=!1;var a;(null!=(a=this.invertedTraceSequence)?a:b.throwNPE()).reverse();try{var t,n;(null!=(t=this.invertedTraceSequence)?t:b.throwNPE()).applyOn(null!=(n=this.currentModel)?n:b.throwNPE())}finally{var s;(null!=(s=this.invertedTraceSequence)?s:b.throwNPE()).reverse();this.activated=!0}}},
reset:function(){this.traceSequence=new a.org.kevoree.modeling.api.trace.TraceSequence(this.compare.factory);this.invertedTraceSequence=new a.org.kevoree.modeling.api.trace.TraceSequence(this.compare.factory)}})}),events:b.definePackage(null,{ModelEvent:b.createClass(null,function(a,b,n,s,f,d,c){this.etype=a;this.elementAttributeType=b;this.elementAttributeName=n;this.value=s;this.previous_value=f;this.source=d;this.previousPath=c},{toString:function(){if(b.isType(this.source,a.org.kevoree.modeling.api.time.TimeAwareKMFContainer))return"ModelEvent[src:["+
this.source.now+"]"+this.source.path()+", type:"+this.etype+", elementAttributeType:"+this.elementAttributeType+", elementAttributeName:"+this.elementAttributeName+", value:"+b.toString(this.value)+", previousValue:"+b.toString(this.previous_value)+"]";var r;return"ModelEvent[src:"+b.toString(null!=(r=this.source)?r.path():null)+", type:"+this.etype+", elementAttributeType:"+this.elementAttributeType+", elementAttributeName:"+this.elementAttributeName+", value:"+b.toString(this.value)+", previousValue:"+
b.toString(this.previous_value)+"]"}}),ModelElementListener:b.createTrait(null)}),trace:b.definePackage(function(){this.ModelTraceConstants=b.createObject(null,function(){this.traceType="t";this.src="s";this.refname="r";this.previouspath="p";this.typename="n";this.objpath="o";this.content="c";this.openJSON="{";this.closeJSON="}";this.bb='"';this.coma=",";this.dp=":"})},{Event2Trace:b.createClass(null,function(a){this.compare=a},{convert:function(r){var t=new b.ArrayList,n=r.etype;if(n===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE){var s;
t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveTrace(null!=(s=r.previousPath)?s:b.throwNPE(),r.elementAttributeName,b.toString(r.previous_value)))}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL){var f;t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveAllTrace(null!=(f=r.previousPath)?f:b.throwNPE(),r.elementAttributeName))}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.ADD){var d,c,e=null!=(d=r.value)?d:b.throwNPE();d=this.compare.inter(e,
e);t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(null!=(c=r.previousPath)?c:b.throwNPE(),r.elementAttributeName,e.path(),e.metaClassName()));t.addAll_xeylzf$(d.traces)}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL){var g;for(c=(null!=(g=r.value)?g:b.throwNPE()).iterator();c.hasNext();)d=c.next(),d=null!=d?d:b.throwNPE(),g=this.compare.inter(d,d),t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(null!=(e=r.previousPath)?e:b.throwNPE(),r.elementAttributeName,
d.path(),d.metaClassName())),t.addAll_xeylzf$(g.traces)}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.SET)if(b.equals(r.elementAttributeType,a.org.kevoree.modeling.api.util.ElementAttributeType.object.ATTRIBUTE)){var k;t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(null!=(k=r.previousPath)?k:b.throwNPE(),r.elementAttributeName,null,a.org.kevoree.modeling.api.util.AttConverter.convFlatAtt(r.value),null))}else{var x,z;t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(null!=
(x=r.previousPath)?x:b.throwNPE(),r.elementAttributeName,null!=(z=r.value)?z.path():null,null,null))}else if(n!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error("Can't convert event : "+r);return(new a.org.kevoree.modeling.api.trace.TraceSequence(this.compare.factory)).populate(t)},inverse:function(r){var t=new b.ArrayList,n=r.etype;if(n===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE){var s,f,d;t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(null!=
(s=r.previousPath)?s:b.throwNPE(),r.elementAttributeName,(null!=(f=r.value)?f:b.throwNPE()).path(),(null!=(d=r.value)?d:b.throwNPE()).metaClassName()))}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL)for(var c,e=(null!=(c=r.value)?c:b.throwNPE()).iterator();e.hasNext();){var g=e.next(),g=null!=g?g:b.throwNPE();c=this.compare.inter(g,g);var k;t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(null!=(k=r.previousPath)?k:b.throwNPE(),r.elementAttributeName,g.path(),
g.metaClassName()));t.addAll_xeylzf$(c.traces)}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.ADD){var x;k=null!=(x=r.value)?x:b.throwNPE();e=this.compare.inter(k,k);t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveTrace(null!=(g=r.previousPath)?g:b.throwNPE(),r.elementAttributeName,k.path()));t.addAll_xeylzf$(e.traces)}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL){var z;for(k=(null!=(z=r.value)?z:b.throwNPE()).iterator();k.hasNext();)g=k.next(),
g=null!=g?g:b.throwNPE(),c=this.compare.inter(g,g),t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveTrace(null!=(e=r.previousPath)?e:b.throwNPE(),r.elementAttributeName,g.path())),t.addAll_xeylzf$(c.traces)}else if(n===a.org.kevoree.modeling.api.util.ActionType.object.SET)if(b.equals(r.elementAttributeType,a.org.kevoree.modeling.api.util.ElementAttributeType.object.ATTRIBUTE)){var A;t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(null!=(A=r.previousPath)?A:b.throwNPE(),
r.elementAttributeName,null,a.org.kevoree.modeling.api.util.AttConverter.convFlatAtt(r.previous_value),null))}else{var C,E;t.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(null!=(C=r.previousPath)?C:b.throwNPE(),r.elementAttributeName,null!=(E=r.previous_value)?E.path():null,null,null))}else if(n!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX)throw Error("Can't convert event : "+r);return(new a.org.kevoree.modeling.api.trace.TraceSequence(this.compare.factory)).populate(t)}}),
DefaultTraceConverter:b.createClass(function(){return[a.org.kevoree.modeling.api.trace.TraceConverter]},function(){this.metaClassNameEquivalence_1_rqkn57$=new b.PrimitiveHashMap;this.metaClassNameEquivalence_2_rqkn58$=new b.PrimitiveHashMap;this.attNameEquivalence_1_vwmrr1$=new b.PrimitiveHashMap;this.attNameEquivalence_2_vwmrr2$=new b.PrimitiveHashMap},{addMetaClassEquivalence:function(a,b){this.metaClassNameEquivalence_1_rqkn57$.put_wn2jw4$(a,b);this.metaClassNameEquivalence_2_rqkn58$.put_wn2jw4$(b,
b)},addAttEquivalence:function(a,t){b.splitString(a,"#");b.splitString(a,"#");this.attNameEquivalence_1_vwmrr1$.put_wn2jw4$(a,t);this.attNameEquivalence_2_vwmrr2$.put_wn2jw4$(t,t)},convert:function(r){return b.isType(r,a.org.kevoree.modeling.api.trace.ModelAddTrace)?new a.org.kevoree.modeling.api.trace.ModelAddTrace(r.srcPath,r.refName,r.previousPath,this.tryConvertClassName(r.typeName)):b.isType(r,a.org.kevoree.modeling.api.trace.ModelSetTrace)?new a.org.kevoree.modeling.api.trace.ModelSetTrace(r.srcPath,
r.refName,r.objPath,r.content,this.tryConvertClassName(r.typeName)):r},tryConvertPath:function(a){return null==a?null:a},tryConvertClassName:function(a){if(null==a)return null;if(this.metaClassNameEquivalence_1_rqkn57$.containsKey_za3rmp$(a)){var t;return null!=(t=this.metaClassNameEquivalence_1_rqkn57$.get_za3rmp$(a))?t:b.throwNPE()}if(this.metaClassNameEquivalence_2_rqkn58$.containsKey_za3rmp$(a)){var n;return null!=(n=this.metaClassNameEquivalence_2_rqkn58$.get_za3rmp$(a))?n:b.throwNPE()}return a},
tryConvertAttName:function(a){if(null==a)return null;if(this.attNameEquivalence_1_vwmrr1$.containsKey_za3rmp$(a)){var t;return null!=(t=this.attNameEquivalence_1_vwmrr1$.get_za3rmp$(a))?t:b.throwNPE()}if(this.attNameEquivalence_2_vwmrr2$.containsKey_za3rmp$(a)){var n;return null!=(n=this.attNameEquivalence_2_vwmrr2$.get_za3rmp$(a))?n:b.throwNPE()}return a}}),ModelTrace:b.createTrait(null,{refName:{get:function(){return this.$refName_eb8jwl$}},traceType:{get:function(){return this.$traceType_cer0bq$}},
srcPath:{get:function(){return this.$srcPath_z3ltm8$}},toString:function(){return this.toCString(!0,!0)}}),ModelControlTrace:b.createClass(function(){return[a.org.kevoree.modeling.api.trace.ModelTrace]},function(b,t){this.$srcPath_5kjq8d$=b;this.traceTypeGlobal=t;this.$refName_qcwzy0$="";this.$traceType_5dhonr$=a.org.kevoree.modeling.api.util.ActionType.object.CONTROL},{srcPath:{get:function(){return this.$srcPath_5kjq8d$}},refName:{get:function(){return this.$refName_qcwzy0$}},traceType:{get:function(){return this.$traceType_5dhonr$}},
toCString:function(r,t){var n=new b.StringBuilder;n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.openJSON);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.traceType);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.util.ActionType.object.CONTROL.code);
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma);null==this.traceTypeGlobal?(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,
this.srcPath)):(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(this.traceTypeGlobal));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.closeJSON);
return n.toString()}}),ModelAddTrace:b.createClass(function(){return[a.org.kevoree.modeling.api.trace.ModelTrace]},function(b,t,n,s){this.$srcPath_uvkbsf$=b;this.$refName_a3722s$=t;this.previousPath=n;this.typeName=s;this.$traceType_2i989x$=a.org.kevoree.modeling.api.util.ActionType.object.ADD},{srcPath:{get:function(){return this.$srcPath_uvkbsf$}},refName:{get:function(){return this.$refName_a3722s$}},traceType:{get:function(){return this.$traceType_2i989x$}},toCString:function(r,t){var n=new b.StringBuilder;
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.openJSON);r&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.traceType),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.util.ActionType.object.ADD.code),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));t&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.srcPath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(this.refName);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);null!=this.previousPath&&
(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.previouspath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.previousPath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb));
null!=this.typeName&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.typename),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.typeName),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb));
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.closeJSON);return n.toString()}}),ModelAddAllTrace:b.createClass(function(){return[a.org.kevoree.modeling.api.trace.ModelTrace]},function(b,t,n,s){this.$srcPath_1h16pc$=b;this.$refName_m9egez$=t;this.previousPath=n;this.typeName=s;this.$traceType_pralmu$=a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL},{srcPath:{get:function(){return this.$srcPath_1h16pc$}},refName:{get:function(){return this.$refName_m9egez$}},traceType:{get:function(){return this.$traceType_pralmu$}},
mkString:function(r){if(null==r)return null;var t=new b.StringBuilder,n=!0;for(r=r.iterator();r.hasNext();){var s=r.next();n||t.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma);t.append(s);n=!1}return t.toString()},toCString:function(r,t){var n=new b.StringBuilder;n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.openJSON);r&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.traceType),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL.code),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));t&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.srcPath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(this.refName);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);null!=this.previousPath&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.previouspath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.mkString(this.previousPath)),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb));null!=this.typeName&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.typename),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.mkString(this.typeName)),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.closeJSON);return n.toString()}}),ModelRemoveTrace:b.createClass(function(){return[a.org.kevoree.modeling.api.trace.ModelTrace]},
function(b,t,n){this.$srcPath_7kbv2k$=b;this.$refName_d81en3$=t;this.objPath=n;this.$traceType_po7rum$=a.org.kevoree.modeling.api.util.ActionType.object.REMOVE},{srcPath:{get:function(){return this.$srcPath_7kbv2k$}},refName:{get:function(){return this.$refName_d81en3$}},traceType:{get:function(){return this.$traceType_po7rum$}},toCString:function(r,t){var n=new b.StringBuilder;n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.openJSON);r&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.traceType),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE.code),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));t&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.srcPath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(this.refName);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.objpath);
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.objPath);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.closeJSON);return n.toString()}}),ModelRemoveAllTrace:b.createClass(function(){return[a.org.kevoree.modeling.api.trace.ModelTrace]},
function(b,t){this.$srcPath_mobmwd$=b;this.$refName_rkf5d4$=t;this.$traceType_z0g113$=a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL},{srcPath:{get:function(){return this.$srcPath_mobmwd$}},refName:{get:function(){return this.$refName_rkf5d4$}},traceType:{get:function(){return this.$traceType_z0g113$}},toCString:function(r,t){var n=new b.StringBuilder;n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.openJSON);r&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.traceType),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL.code),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));t&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.srcPath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(this.refName);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.closeJSON);return n.toString()}}),ModelSetTrace:b.createClass(function(){return[a.org.kevoree.modeling.api.trace.ModelTrace]},
function(b,t,n,s,f){this.$srcPath_guqstu$=b;this.$refName_xdzzfn$=t;this.objPath=n;this.content=s;this.typeName=f;this.$traceType_j5yedg$=a.org.kevoree.modeling.api.util.ActionType.object.SET},{srcPath:{get:function(){return this.$srcPath_guqstu$}},refName:{get:function(){return this.$refName_xdzzfn$}},traceType:{get:function(){return this.$traceType_j5yedg$}},toCString:function(r,t){var n=new b.StringBuilder;n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.openJSON);r&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.traceType),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.util.ActionType.object.SET.code),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));t&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.srcPath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);n.append(this.refName);n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb);null!=this.objPath&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.objpath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.objPath),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb));null!=this.content&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.content),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.content),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb));null!=this.typeName&&(n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.coma),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),
n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.typename),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.dp),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb),a.org.kevoree.modeling.api.json.JSONString.encodeBuffer(n,this.typeName),n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.bb));n.append(a.org.kevoree.modeling.api.trace.ModelTraceConstants.closeJSON);return n.toString()}}),
ModelTraceApplicator:b.createClass(null,function(a,b){this.targetModel=a;this.factory=b;this.pendingObjPath=this.pendingParentRefName=this.pendingParent=this.pendingObj=null;this.fireEvents=!0},{tryClosePending:function(r){if(null!=this.pendingObj&&!b.equals(this.pendingObjPath,r)){var t,n;(null!=(t=this.pendingParent)?t:b.throwNPE()).reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,null!=(n=this.pendingParentRefName)?n:b.throwNPE(),this.pendingObj,!0,this.fireEvents);this.pendingParent=
this.pendingParentRefName=this.pendingObjPath=this.pendingObj=null}},createOrAdd:function(r,t,n,s){var f=null;null!=r&&(f=this.targetModel.findByPath(r));if(null!=f)t.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.ADD,n,f,!0,this.fireEvents);else{if(null==s)throw Error("Unknow typeName for potential path "+b.toString(r)+", to store in "+n+", unconsistency error");this.pendingObj=this.factory.create(s);this.pendingObjPath=r;this.pendingParentRefName=n;this.pendingParent=t}},applyTraceOnModel:function(r){for(r=
r.traces.iterator();r.hasNext();){var t=r.next(),n=this.targetModel;if(b.isType(t,a.org.kevoree.modeling.api.trace.ModelAddTrace)){this.tryClosePending(null);if(!b.equals(t.srcPath,"")){n=this.targetModel.findByPath(t.srcPath);if(null==n)throw Error("Add Trace source not found for path : "+t.srcPath+" pending "+this.pendingObjPath+"\n"+t.toString());n=null!=n?n:b.throwNPE()}this.createOrAdd(t.previousPath,n,t.refName,t.typeName)}if(b.isType(t,a.org.kevoree.modeling.api.trace.ModelAddAllTrace)){this.tryClosePending(null);
for(var s=0,f,d=(null!=(f=t.previousPath)?f:b.throwNPE()).iterator();d.hasNext();){var c=d.next(),e;this.createOrAdd(c,n,t.refName,(null!=(e=t.typeName)?e:b.throwNPE()).get_za3lpa$(s));s++}}b.isType(t,a.org.kevoree.modeling.api.trace.ModelRemoveTrace)&&(this.tryClosePending(t.srcPath),s=this.targetModel,b.equals(t.srcPath,"")||(s=this.targetModel.findByPath(t.srcPath)),null!=s&&(null!=s?s:b.throwNPE()).reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE,t.refName,this.targetModel.findByPath(t.objPath),
!0,this.fireEvents));b.isType(t,a.org.kevoree.modeling.api.trace.ModelRemoveAllTrace)&&(this.tryClosePending(t.srcPath),s=this.targetModel,b.equals(t.srcPath,"")||(s=this.targetModel.findByPath(t.srcPath)),null!=s&&(null!=s?s:b.throwNPE()).reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL,t.refName,null,!0,this.fireEvents));if(b.isType(t,a.org.kevoree.modeling.api.trace.ModelSetTrace)){this.tryClosePending(t.srcPath);if(!b.equals(t.srcPath,"")&&!b.equals(t.srcPath,this.pendingObjPath)){n=
this.targetModel.findByPath(t.srcPath);if(null==n)throw Error("Set Trace source not found for path : "+t.srcPath+" pending "+this.pendingObjPath+"\n"+t.toString());n=null!=n?n:b.throwNPE()}else if(b.equals(t.srcPath,this.pendingObjPath)&&null!=this.pendingObj)var g,n=null!=(g=this.pendingObj)?g:b.throwNPE();null!=t.content?n.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,t.refName,t.content,!0,this.fireEvents):(s=null!=t.objPath?this.targetModel.findByPath(t.objPath):null,
null!=s?n.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,t.refName,s,!0,this.fireEvents):null==t.typeName||b.equals(t.typeName,"")?n.reflexiveMutator(a.org.kevoree.modeling.api.util.ActionType.object.SET,t.refName,s,!0,this.fireEvents):this.createOrAdd(t.objPath,n,t.refName,t.typeName))}}this.tryClosePending(null)}}),TraceConverter:b.createTrait(null),TraceSequence:b.createClass(null,function(a){this.factory=a;this.traces=new b.ArrayList},{populate:function(a){this.traces.addAll_xeylzf$(a);
return this},append:function(a){this.traces.addAll_xeylzf$(a.traces)},populateFromString:function(b){return this.populateFromStream(a.org.kevoree.modeling.api.util.ByteConverter.byteArrayInputStreamFromString(b))},populateFromStream:function(r){var t=null,n=null;r=new a.org.kevoree.modeling.api.json.Lexer(r);var s=r.nextToken();if(s.tokenType!==a.org.kevoree.modeling.api.json.Type.LEFT_BRACKET)throw Error("Bad Format : expect [");for(var s=r.nextToken(),f=new b.PrimitiveHashMap,d=null;s.tokenType!==
a.org.kevoree.modeling.api.json.Type.EOF&&s.tokenType!==a.org.kevoree.modeling.api.json.Type.RIGHT_BRACKET;){s.tokenType===a.org.kevoree.modeling.api.json.Type.LEFT_BRACE&&f.clear();s.tokenType===a.org.kevoree.modeling.api.json.Type.VALUE&&(null!=d?(f.put_wn2jw4$(null!=d?d:b.throwNPE(),b.toString(s.value)),d=null):d=b.toString(s.value));if(s.tokenType===a.org.kevoree.modeling.api.json.Type.RIGHT_BRACE)if(s=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.traceType),null==s&&(s=n),
s===a.org.kevoree.modeling.api.util.ActionType.object.CONTROL.code){s=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src);if(null!=s)var c,t=null!=(c=a.org.kevoree.modeling.api.json.JSONString.unescape(s))?c:b.throwNPE();s=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname);null!=s&&(n=s)}else if(s===a.org.kevoree.modeling.api.util.ActionType.object.SET.code){var s=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),s=null==s?t:a.org.kevoree.modeling.api.json.JSONString.unescape(s),
e;this.traces.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelSetTrace(null!=s?s:b.throwNPE(),null!=(e=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname))?e:b.throwNPE(),a.org.kevoree.modeling.api.json.JSONString.unescape(f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.objpath)),a.org.kevoree.modeling.api.json.JSONString.unescape(f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.content)),a.org.kevoree.modeling.api.json.JSONString.unescape(f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.typename))))}else if(s===
a.org.kevoree.modeling.api.util.ActionType.object.ADD.code){var s=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),s=null==s?t:a.org.kevoree.modeling.api.json.JSONString.unescape(s),g,k;this.traces.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddTrace(null!=s?s:b.throwNPE(),null!=(g=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname))?g:b.throwNPE(),a.org.kevoree.modeling.api.json.JSONString.unescape(null!=(k=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.previouspath))?
k:b.throwNPE()),f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.typename)))}else if(s===a.org.kevoree.modeling.api.util.ActionType.object.ADD_ALL.code){var s=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),s=null==s?t:a.org.kevoree.modeling.api.json.JSONString.unescape(s),x,z,A,C,E;this.traces.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelAddAllTrace(null!=s?s:b.throwNPE(),null!=(x=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname))?
x:b.throwNPE(),null!=(A=null!=(z=a.org.kevoree.modeling.api.json.JSONString.unescape(f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.content)))?b.splitString(z,";"):null)?a.kotlin.toList_2hx8bi$(A):null,null!=(E=null!=(C=a.org.kevoree.modeling.api.json.JSONString.unescape(f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.typename)))?b.splitString(C,";"):null)?a.kotlin.toList_2hx8bi$(E):null))}else if(s===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE.code){var s=
f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),s=null==s?t:a.org.kevoree.modeling.api.json.JSONString.unescape(s),F,G,H;this.traces.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveTrace(null!=s?s:b.throwNPE(),null!=(F=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname))?F:b.throwNPE(),null!=(H=a.org.kevoree.modeling.api.json.JSONString.unescape(null!=(G=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.objpath))?G:b.throwNPE()))?
H:b.throwNPE()))}else if(s===a.org.kevoree.modeling.api.util.ActionType.object.REMOVE_ALL.code){var s=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.src),s=null==s?t:a.org.kevoree.modeling.api.json.JSONString.unescape(s),I;this.traces.add_za3rmp$(new a.org.kevoree.modeling.api.trace.ModelRemoveAllTrace(null!=s?s:b.throwNPE(),null!=(I=f.get_za3rmp$(a.org.kevoree.modeling.api.trace.ModelTraceConstants.refname))?I:b.throwNPE()))}else s!==a.org.kevoree.modeling.api.util.ActionType.object.RENEW_INDEX.code&&
b.println("Trace lost !!!");s=r.nextToken()}return this},exportToString:function(){var r=new b.StringBuilder;r.append("[");for(var t=!0,n=null,s=null,f=this.traces.iterator();f.hasNext();){var d=f.next();t||r.append(",\n");null!=n&&b.equals(n,d.srcPath)||(r.append((new a.org.kevoree.modeling.api.trace.ModelControlTrace(d.srcPath,null)).toString()),r.append(",\n"),n=d.srcPath);null!=s&&b.equals(s,d.traceType.code)||(r.append((new a.org.kevoree.modeling.api.trace.ModelControlTrace("",d.traceType.code)).toString()),
r.append(",\n"),s=d.traceType.code);r.append(d.toCString(!1,!1));t=!1}r.append("]");return r.toString()},toString:function(){return this.exportToString()},applyOn:function(b){(new a.org.kevoree.modeling.api.trace.ModelTraceApplicator(b,this.factory)).applyTraceOnModel(this);return!0},silentlyApplyOn:function(b){b=new a.org.kevoree.modeling.api.trace.ModelTraceApplicator(b,this.factory);b.fireEvents=!1;b.applyTraceOnModel(this);return!0},reverse:function(){for(var r=new b.ArrayList,t=a.kotlin.get_size_1(this.traces);0<
t;)t-=1,r.add_za3rmp$(this.traces.get_za3lpa$(t));this.traces=r}})})})}),log:b.definePackage(function(){this.Log=b.createObject(null,function(){this.LEVEL_NONE=6;this.LEVEL_ERROR=5;this.LEVEL_WARN=4;this.LEVEL_INFO=3;this.LEVEL_DEBUG=2;this.LEVEL_TRACE=1;this.$level_qhmnt5$=this.LEVEL_INFO;this._ERROR_oj0992$=this.level<=this.LEVEL_ERROR;this._WARN_qp2148$=this.level<=this.LEVEL_WARN;this._INFO_qpapkw$=this.level<=this.LEVEL_INFO;this._DEBUG_oi7u3l$=this.level<=this.LEVEL_DEBUG;this._TRACE_or8t8z$=
this.level<=this.LEVEL_TRACE;this.logger=new a.org.kevoree.log.Logger;this.beginParam="{";this.endParam="}"},{level:{get:function(){return this.$level_qhmnt5$},set:function(a){this.$level_qhmnt5$=a;this._ERROR_oj0992$=a<=this.LEVEL_ERROR;this._WARN_qp2148$=a<=this.LEVEL_WARN;this._INFO_qpapkw$=a<=this.LEVEL_INFO;this._DEBUG_oi7u3l$=a<=this.LEVEL_DEBUG;this._TRACE_or8t8z$=a<=this.LEVEL_TRACE}},NONE:function(){this.level=this.LEVEL_NONE},ERROR:function(){this.level=this.LEVEL_ERROR},WARN:function(){this.level=
this.LEVEL_WARN},INFO:function(){this.level=this.LEVEL_INFO},DEBUG:function(){this.level=this.LEVEL_DEBUG},TRACE:function(){this.level=this.LEVEL_TRACE},processMessage:function(a,t,n,s,f,d){if(null==t)return a;for(var c=new b.StringBuilder,e=!1,g=0,k=0;k<a.length;){var x=a.charAt(k);e?(x===this.endParam?(g++,1===g?(c=new b.StringBuilder,c.append(a.substring(0,k-1)),c.append((null!=t?t:b.throwNPE()).toString())):2===g?c.append((null!=n?n:b.throwNPE()).toString()):3===g?c.append((null!=s?s:b.throwNPE()).toString()):
4===g?c.append((null!=f?f:b.throwNPE()).toString()):5===g&&c.append((null!=d?d:b.throwNPE()).toString())):null!=c&&(a.charAt(k-1),c.append(x)),e=!1):x===this.beginParam?e=!0:null!=c&&c.append(x);k+=1}return null!=c?c.toString():a},error_1:function(a,b,n,s,f,d,c){void 0===n&&(n=null);void 0===s&&(s=null);void 0===f&&(f=null);void 0===d&&(d=null);void 0===c&&(c=null);this._ERROR_oj0992$&&this.internal_error(this.processMessage(a,n,s,f,d,c),b)},error:function(a,b,n,s,f,d){void 0===b&&(b=null);void 0===
n&&(n=null);void 0===s&&(s=null);void 0===f&&(f=null);void 0===d&&(d=null);this._ERROR_oj0992$&&this.internal_error(this.processMessage(a,b,n,s,f,d),null)},internal_error:function(a,b){this.logger.log(this.LEVEL_ERROR,a,b)},warn_1:function(a,b,n,s,f,d,c){void 0===n&&(n=null);void 0===s&&(s=null);void 0===f&&(f=null);void 0===d&&(d=null);void 0===c&&(c=null);this._WARN_qp2148$&&this.internal_warn(this.processMessage(a,n,s,f,d,c),b)},warn:function(a,b,n,s,f,d){void 0===b&&(b=null);void 0===n&&(n=null);
void 0===s&&(s=null);void 0===f&&(f=null);void 0===d&&(d=null);this._WARN_qp2148$&&this.internal_warn(this.processMessage(a,b,n,s,f,d),null)},internal_warn:function(a,b){this.logger.log(this.LEVEL_WARN,a,b)},info_1:function(a,b,n,s,f,d,c){void 0===n&&(n=null);void 0===s&&(s=null);void 0===f&&(f=null);void 0===d&&(d=null);void 0===c&&(c=null);this._INFO_qpapkw$&&this.internal_info(this.processMessage(a,n,s,f,d,c),b)},info:function(a,b,n,s,f,d){void 0===b&&(b=null);void 0===n&&(n=null);void 0===s&&
(s=null);void 0===f&&(f=null);void 0===d&&(d=null);this._INFO_qpapkw$&&this.internal_info(this.processMessage(a,b,n,s,f,d),null)},internal_info:function(a,b){this.logger.log(this.LEVEL_INFO,a,b)},debug_1:function(a,b,n,s,f,d,c){void 0===n&&(n=null);void 0===s&&(s=null);void 0===f&&(f=null);void 0===d&&(d=null);void 0===c&&(c=null);this._DEBUG_oi7u3l$&&this.internal_debug(this.processMessage(a,n,s,f,d,c),b)},debug:function(a,b,n,s,f,d){void 0===b&&(b=null);void 0===n&&(n=null);void 0===s&&(s=null);
void 0===f&&(f=null);void 0===d&&(d=null);this._DEBUG_oi7u3l$&&this.internal_debug(this.processMessage(a,b,n,s,f,d),null)},internal_debug:function(a,b){this.logger.log(this.LEVEL_DEBUG,a,b)},trace_1:function(a,b,n,s,f,d,c){void 0===n&&(n=null);void 0===s&&(s=null);void 0===f&&(f=null);void 0===d&&(d=null);void 0===c&&(c=null);this._TRACE_or8t8z$&&this.internal_trace(this.processMessage(a,n,s,f,d,c),b)},trace:function(a,b,n,s,f,d){void 0===b&&(b=null);void 0===n&&(n=null);void 0===s&&(s=null);void 0===
f&&(f=null);void 0===d&&(d=null);this._TRACE_or8t8z$&&this.internal_trace(this.processMessage(a,b,n,s,f,d),null)},internal_trace:function(a,b){this.logger.log(this.LEVEL_TRACE,a,b)}})},{Logger:b.createClass(null,function(){this.firstLogTime=(new Date).getTime();this.error_msg=" ERROR: ";this.warn_msg=" WARN: ";this.info_msg=" INFO: ";this.debug_msg=" DEBUG: ";this.trace_msg=" TRACE: ";this.category=null},{setCategory:function(a){this.category=a},log:function(r,t,n){var s=new b.StringBuilder,f=(new Date).getTime()-
this.firstLogTime,d=f/6E4|0,f=(f/1E3|0)%60;9>=d&&s.append("0");s.append(d.toString());s.append(":");9>=f&&s.append("0");s.append(f.toString());r===a.org.kevoree.log.Log.LEVEL_ERROR?s.append(this.error_msg):r===a.org.kevoree.log.Log.LEVEL_WARN?s.append(this.warn_msg):r===a.org.kevoree.log.Log.LEVEL_INFO?s.append(this.info_msg):r===a.org.kevoree.log.Log.LEVEL_DEBUG?s.append(this.debug_msg):r===a.org.kevoree.log.Log.LEVEL_TRACE&&s.append(this.trace_msg);if(null!=this.category){s.append("[");var c;s.append((null!=
(c=this.category)?c:b.throwNPE()).toString());s.append("] ")}s.append(t);null!=n&&s.append(b.toString(n.getMessage()));r===a.org.kevoree.log.Log.LEVEL_ERROR?console.error(s.toString()):r===a.org.kevoree.log.Log.LEVEL_WARN?console.warn(s.toString()):r===a.org.kevoree.log.Log.LEVEL_INFO?console.info(s.toString()):r===a.org.kevoree.log.Log.LEVEL_DEBUG?console.log(s.toString()):r===a.org.kevoree.log.Log.LEVEL_TRACE&&console.log(s.toString())}})})}),w3c:b.definePackage(null,{dom:b.definePackage(null,{events:b.definePackage(null,
{EventListener:b.createTrait(null)})})})}),kotlin:b.definePackage(function(){this.stdlib_emptyList_w9bu57$=new b.ArrayList;this.stdlib_emptyMap_h2vi7z$=new b.ComplexHashMap},{dom:b.definePackage(null,{createDocument:function(){return document.implementation.createDocument(null,null,null)},toXmlString_asww5t$:function(a){return a.outerHTML},toXmlString_rq0l4m$:function(a,b){return a.outerHTML},eventHandler:function(b){return new a.kotlin.dom.EventListenerHandler(b)},EventListenerHandler:b.createClass(function(){return[a.org.w3c.dom.events.EventListener]},
function(a){this.handler=a},{handleEvent_9ojx7i$:function(a){null!=a&&this.handler(a)}}),mouseEventHandler$f:function(a){return function(t){b.isType(t,MouseEvent)&&a(t)}},mouseEventHandler:function(b){return a.kotlin.dom.eventHandler(a.kotlin.dom.mouseEventHandler$f(b))},on_10gtds$:function(b,t,n,s){return a.kotlin.dom.on_edii0a$(b,t,n,a.kotlin.dom.eventHandler(s))},on_edii0a$:function(r,t,n,s){b.isType(r,EventTarget)?(r.addEventListener(t,s,n),r=new a.kotlin.dom.CloseableEventListener(r,s,t,n)):
r=null;return r},CloseableEventListener:b.createClass(function(){return[b.Closeable]},function(a,b,n,s){this.target=a;this.listener=b;this.name=n;this.capture=s},{close:function(){this.target.removeEventListener(this.name,this.listener,this.capture)}}),onClick_alenf6$:function(b,t,n){void 0===t&&(t=!1);return a.kotlin.dom.on_edii0a$(b,"click",t,a.kotlin.dom.mouseEventHandler(n))},onDoubleClick_alenf6$:function(b,t,n){void 0===t&&(t=!1);return a.kotlin.dom.on_edii0a$(b,"dblclick",t,a.kotlin.dom.mouseEventHandler(n))},
emptyElementList:function(){return b.emptyList()},emptyNodeList:function(){return b.emptyList()},get_text:{value:function(a){return a.textContent}},set_text:{value:function(a,b){a.textContent=b}},get_childrenText:{value:function(r){var t=new b.StringBuilder;r=r.childNodes;for(var n=0,s=r.length;n<s;){var f=r.item(n);null!=f&&a.kotlin.dom.isText(f)&&t.append(f.nodeValue);n++}return t.toString()}},set_childrenText:{value:function(b,t){for(var n=a.kotlin.dom.children(b).iterator();n.hasNext();){var s=
n.next();a.kotlin.dom.isText(s)&&b.removeChild(s)}a.kotlin.dom.addText(b,t)}},get_id:{value:function(a){var b;return null!=(b=a.getAttribute("id"))?b:""}},set_id:{value:function(a,b){a.setAttribute("id",b);a.setIdAttribute("id",!0)}},get_style:{value:function(a){var b;return null!=(b=a.getAttribute("style"))?b:""}},set_style:{value:function(a,b){a.setAttribute("style",b)}},get_classes:{value:function(a){var b;return null!=(b=a.getAttribute("class"))?b:""}},set_classes:{value:function(a,b){a.setAttribute("class",
b)}},hasClass:function(b,t){var n=a.kotlin.dom.get_classes(b);return a.js.matches_94jgcu$(n,"(^|.*\\s+)"+t+"($|\\s+.*)")},children:function(b){return a.kotlin.dom.toList(null!=b?b.childNodes:null)},childElements$f:function(a){return a.nodeType===Node.ELEMENT_NODE},childElements$f_0:function(a){return a},childElements:function(b){return a.kotlin.map_vqr6wr$(a.kotlin.filter_vqr6wr$(a.kotlin.dom.children(b),a.kotlin.dom.childElements$f),a.kotlin.dom.childElements$f_0)},childElements_1$f:function(a){return function(t){return t.nodeType===
Node.ELEMENT_NODE&&b.equals(t.nodeName,a)}},childElements_1$f_0:function(a){return a},childElements_1:function(b,t){return a.kotlin.map_vqr6wr$(a.kotlin.filter_vqr6wr$(a.kotlin.dom.children(b),a.kotlin.dom.childElements_1$f(t)),a.kotlin.dom.childElements_1$f_0)},get_elements:{value:function(b){return a.kotlin.dom.toElementList(null!=b?b.getElementsByTagName("*"):null)}},get_elements_0:{value:function(b){return a.kotlin.dom.toElementList(null!=b?b.getElementsByTagName("*"):null)}},elements_1:function(b,
t){return a.kotlin.dom.toElementList(null!=b?b.getElementsByTagName(t):null)},elements_2:function(b,t){return a.kotlin.dom.toElementList(null!=b?b.getElementsByTagName(t):null)},elements_3:function(b,t,n){return a.kotlin.dom.toElementList(null!=b?b.getElementsByTagNameNS(t,n):null)},elements_2_0:function(b,t,n){return a.kotlin.dom.toElementList(null!=b?b.getElementsByTagNameNS(t,n):null)},toList:function(b){return null==b?a.kotlin.dom.emptyNodeList():new a.kotlin.dom.NodeListAsList(b)},toElementList:function(r){return null==
r?new b.ArrayList:new a.kotlin.dom.ElementListAsList(r)},get$f:function(b){return function(t){return a.kotlin.dom.hasClass(t,b.substring(1))}},get:function(r,t){var n;if(null!=(null!=r?r.documentElement:null))if(b.equals(t,"*"))n=a.kotlin.dom.get_elements(r);else if(t.startsWith("."))n=a.kotlin.toList_h3panj$(a.kotlin.filter_vqr6wr$(a.kotlin.dom.get_elements(r),a.kotlin.dom.get$f(t)));else{if(t.startsWith("#"))return n=t.substring(1),n=null!=r?r.getElementById(n):null,null!=n?a.kotlin.arrayListOf_mzrxf8$([n]):
a.kotlin.dom.emptyElementList();n=a.kotlin.dom.elements_2(r,t)}else n=a.kotlin.dom.emptyElementList();return n},get_1$f:function(b){return function(t){return a.kotlin.dom.hasClass(t,b.substring(1))}},get_1:function(r,t){var n;if(b.equals(t,"*"))n=a.kotlin.dom.get_elements_0(r);else if(t.startsWith("."))n=a.kotlin.toList_h3panj$(a.kotlin.filter_vqr6wr$(a.kotlin.dom.get_elements_0(r),a.kotlin.dom.get_1$f(t)));else{if(t.startsWith("#")){var s=null!=(n=r.ownerDocument)?n.getElementById(t.substring(1)):
null;return null!=s?a.kotlin.arrayListOf_mzrxf8$([s]):a.kotlin.dom.emptyElementList()}n=a.kotlin.dom.elements_1(r,t)}return n},NodeListAsList:b.createClass(function(){return[b.AbstractList]},function t(a){t.baseInitializer.call(this);this.nodeList=a},{get_za3lpa$:function(a){var b=this.nodeList.item(a);if(null==b)throw new RangeError("NodeList does not contain a node at index: "+a);return b},size:function(){return this.nodeList.length}}),ElementListAsList:b.createClass(function(){return[b.AbstractList]},
function n(a){n.baseInitializer.call(this);this.nodeList=a},{get_za3lpa$:function(a){var s=this.nodeList.item(a);if(null==s)throw new RangeError("NodeList does not contain a node at index: "+a);if(s.nodeType===Node.ELEMENT_NODE)return s;throw new b.IllegalArgumentException("Node is not an Element as expected but is "+s);},size:function(){return this.nodeList.length}}),clear:function(a){for(;;){var b=a.firstChild;if(null==b)break;else a.removeChild(b)}},nextSiblings:function(b){return new a.kotlin.dom.NextSiblings(b)},
NextSiblings:b.createClass(null,function(a){this.node=a},{iterator:function(){return a.kotlin.dom.NextSiblings.iterator$f(this)}},{iterator$f:function(n){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},function f(){f.baseInitializer.call(this)},{computeNext:function(){var a=n.node.nextSibling;null!=a?(this.setNext_za3rmp$(a),n.node=a):this.done()}})}}),previousSiblings:function(b){return new a.kotlin.dom.PreviousSiblings(b)},PreviousSiblings:b.createClass(null,function(a){this.node=
a},{iterator:function(){return a.kotlin.dom.PreviousSiblings.iterator$f(this)}},{iterator$f:function(n){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},function f(){f.baseInitializer.call(this)},{computeNext:function(){var a=n.node.previousSibling;null!=a?(this.setNext_za3rmp$(a),n.node=a):this.done()}})}}),isText:function(a){a=a.nodeType;return a===Node.TEXT_NODE||a===Node.CDATA_SECTION_NODE},attribute:function(a,b){var f;return null!=(f=a.getAttribute(b))?f:""},get_head:{value:function(a){return null!=
a&&0<a.length?a.item(0):null}},get_first:{value:function(b){return a.kotlin.dom.get_head(b)}},get_tail:{value:function(a){if(null==a)return null;var b=a.length;return 0<b?a.item(b-1):null}},get_last:{value:function(b){return a.kotlin.dom.get_tail(b)}},toXmlString_1:function(b,s){void 0===s&&(s=!1);return null==b?"":a.kotlin.dom.nodesToXmlString_lwhwg8$(a.kotlin.dom.toList(b),s)},nodesToXmlString_lwhwg8$:function(n,s){void 0===s&&(s=!1);for(var f=new b.StringBuilder,d=n.iterator();d.hasNext();){var c=
d.next();f.append(a.kotlin.dom.toXmlString_rq0l4m$(c,s))}return f.toString()},plus_1:function(a,b){null!=b&&a.appendChild(b);return a},plus:function(b,s){return a.kotlin.dom.addText(b,s)},plusAssign:function(b,s){return a.kotlin.dom.addText(b,s)},createElement:function(a,b,f){a=a.createElement(b);f.call(a);return a},createElement_1:function(b,s,f,d){void 0===f&&(f=null);b=a.kotlin.dom.ownerDocument(b,f).createElement(s);d.call(b);return b},ownerDocument:function(a,s){void 0===s&&(s=null);var f=a.nodeType===
Node.DOCUMENT_NODE?a:null==s?a.ownerDocument:s;if(null==f)throw new b.IllegalArgumentException("Element does not have an ownerDocument and none was provided for: "+a);return f},addElement:function(b,s,f){s=a.kotlin.dom.createElement(b,s,f);b.appendChild(s);return s},addElement_1:function(b,s,f,d){void 0===f&&(f=null);s=a.kotlin.dom.createElement_1(b,s,f,d);b.appendChild(s);return s},addText:function(b,s,f){void 0===f&&(f=null);null!=s&&(s=a.kotlin.dom.ownerDocument(b,f).createTextNode(s),b.appendChild(s));
return b}}),test:b.definePackage(function(){this.asserter=new a.kotlin.test.QUnitAsserter},{todo_n8bj3p$:function(a){b.println("TODO at "+a)},QUnitAsserter:b.createClass(function(){return[a.kotlin.test.Asserter]},null,{assertTrue_ivxn3r$:function(a,b){ok(b,a)},assertEquals_a59ba6$:function(a,s,f){ok(b.equals(s,f),a+". Expected \x3c"+b.toString(s)+"\x3e actual \x3c"+b.toString(f)+"\x3e")},assertNotNull_bm4g0d$:function(a,b){ok(null!=b,a)},assertNull_bm4g0d$:function(a,b){ok(null==b,a)},fail_61zpoe$:function(a){ok(!1,
a)}}),assertTrue_2xfrrb$:function(b,s){var f=s();a.kotlin.test.asserter.assertTrue_ivxn3r$(b,f)},assertTrue_n8bj3p$:function(b){a.kotlin.test.assertTrue_2xfrrb$("expected true",b)},assertNot_2xfrrb$f:function(a){return function(){return!a()}},assertNot_2xfrrb$:function(b,s){a.kotlin.test.assertTrue_2xfrrb$(b,a.kotlin.test.assertNot_2xfrrb$f(s))},assertNot_n8bj3p$:function(b){a.kotlin.test.assertNot_2xfrrb$("expected false",b)},assertTrue_8kj6y5$:function(b,s){void 0===s&&(s="");return a.kotlin.test.assertEquals_8vv676$(!0,
b,s)},assertFalse_8kj6y5$:function(b,s){void 0===s&&(s="");return a.kotlin.test.assertEquals_8vv676$(!1,b,s)},assertEquals_8vv676$:function(b,s,f){void 0===f&&(f="");a.kotlin.test.asserter.assertEquals_a59ba6$(f,b,s)},assertNotNull_hwpqgh$:function(n,s){void 0===s&&(s="");a.kotlin.test.asserter.assertNotNull_bm4g0d$(s,n);return null!=n?n:b.throwNPE()},assertNotNull_74f9dl$:function(b,s){a.kotlin.test.assertNotNull_ll92s9$(b,"",s)},assertNotNull_ll92s9$:function(b,s,f){a.kotlin.test.asserter.assertNotNull_bm4g0d$(s,
b);null!=b&&f(b)},assertNull_hwpqgh$:function(b,s){void 0===s&&(s="");a.kotlin.test.asserter.assertNull_bm4g0d$(s,b)},fail_61zpoe$:function(b){void 0===b&&(b="");a.kotlin.test.asserter.fail_61zpoe$(b)},expect_74f9dk$:function(b,s){a.kotlin.test.expect_ll92sa$(b,"expected "+b,s)},expect_ll92sa$:function(b,s,f){f=f();a.kotlin.test.assertEquals_8vv676$(b,f,s)},fails_n8bj3p$:function(b){try{return b(),a.kotlin.test.asserter.fail_61zpoe$("Expected an exception to be thrown"),null}catch(s){return s}},Asserter:b.createTrait(null)}),
Pair:b.createClass(null,function(a,b){this.first=a;this.second=b},{component1:function(){return this.first},component2:function(){return this.second},toString:function(){return"("+this.first+", "+this.second+")"}}),Triple:b.createClass(null,function(a,b,f){this.first=a;this.second=b;this.third=f},{component1:function(){return this.first},component2:function(){return this.second},component3:function(){return this.third},toString:function(){return"("+this.first+", "+this.second+", "+this.third+")"}}),
toString_h3panj$:function(b){return a.kotlin.makeString_mc2pv1$(b,", ","[","]")},mapValues_lh0hhz$:function(n,s){return a.kotlin.mapValuesTo_7qivbo$(n,new b.ComplexHashMap,s)},iterator_rscjuh$:function(a){return b.createObject(function(){return[b.Iterator]},null,{hasNext:function(){return a.hasMoreElements()},next:function(){return a.nextElement()}})},iterator_h40uyb$:function(a){return a},EmptyIterableException:b.createClass(function(){return[b.RuntimeException]},function s(a){s.baseInitializer.call(this,
a+" is empty");this.it=a}),DuplicateKeyException:b.createClass(function(){return[b.RuntimeException]},function f(a){void 0===a&&(a="Duplicate keys detected");f.baseInitializer.call(this,a)}),get_size:{value:function(a){return a.size()}},get_empty:{value:function(a){return a.isEmpty()}},set_f7ra8x$:function(a,b,c){return a.put_wn2jw4$(b,c)},orEmpty_s8ckw1$:function(f){return null!=f?f:a.kotlin.stdlib_emptyMap()},contains_6halgi$:function(a,b){return a.containsKey_za3rmp$(b)},get_key:{value:function(a){return a.getKey()}},
get_value:{value:function(a){return a.getValue()}},component1:function(a){return a.getKey()},component2:function(a){return a.getValue()},getOrElse_9bj33b$:function(a,b,c){return a.containsKey_za3rmp$(b)?a.get_za3rmp$(b):c()},getOrPut_ynyybx$:function(a,b,c){if(a.containsKey_za3rmp$(b))return a.get_za3rmp$(b);c=c();a.put_wn2jw4$(b,c);return c},iterator_s8ckw1$:function(a){return a.entrySet().iterator()},mapValuesTo_7qivbo$:function(f,b,c){for(f=a.kotlin.iterator_s8ckw1$(f);f.hasNext();){var e=f.next(),
g=c(e);b.put_wn2jw4$(a.kotlin.get_key(e),g)}return b},putAll_nvpytz$:function(a,b){var c,e;c=b.length;for(e=0;e!==c;++e){var g=b[e],k=g.component1(),g=g.component2();a.put_wn2jw4$(k,g)}},toMap_cj6vvg$:function(a,b){b.putAll_za3j1t$(a);return b},toMap_uxbsj8$:function(f,b){for(var c=f.iterator();c.hasNext();){var e=c.next(),g=e.component1(),e=e.component2();if(b.containsKey_za3rmp$(g))throw new a.kotlin.DuplicateKeyException;b.put_wn2jw4$(g,e)}return b},toMap_h3panj$:function(f){return a.kotlin.toMap_uxbsj8$(f,
new b.ComplexHashMap)},mapValues_gld13f$:function(f,d){return a.kotlin.mapValuesTo_7qivbo$(f,new b.ComplexHashMap(a.kotlin.get_size(f)),d)},get_lastIndex:{value:function(a){return a.length-1}},get_lastIndex_0:{value:function(a){return a.length-1}},get_lastIndex_1:{value:function(a){return a.length-1}},get_lastIndex_2:{value:function(a){return a.length-1}},get_lastIndex_3:{value:function(a){return a.length-1}},get_lastIndex_4:{value:function(a){return a.length-1}},get_lastIndex_5:{value:function(a){return a.length-
1}},get_lastIndex_6:{value:function(a){return a.length-1}},get_lastIndex_7:{value:function(a){return a.length-1}},Stream:b.createTrait(null),streamOf_mzrxf8$:function(f){return a.kotlin.stream_2hx8bi$(f)},FilteringStream:b.createClass(function(){return[a.kotlin.Stream]},function(a,b,c){void 0===b&&(b=!0);this.stream=a;this.sendWhen=b;this.predicate=c},{iterator:function(){return a.kotlin.FilteringStream.iterator$f(this)}},{iterator$f:function(f){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},
function c(){c.baseInitializer.call(this);this.iterator=f.stream.iterator()},{computeNext:function(){for(;this.iterator.hasNext();){var a=this.iterator.next();if(b.equals(f.predicate(a),f.sendWhen)){this.setNext_za3rmp$(a);return}}this.done()}})}}),TransformingStream:b.createClass(function(){return[a.kotlin.Stream]},function(a,b){this.stream=a;this.transformer=b},{iterator:function(){return a.kotlin.TransformingStream.iterator$f(this)}},{iterator$f:function(f){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},
function c(){c.baseInitializer.call(this);this.iterator=f.stream.iterator()},{computeNext:function(){this.iterator.hasNext()?this.setNext_za3rmp$(f.transformer(this.iterator.next())):this.done()}})}}),MergingStream:b.createClass(function(){return[a.kotlin.Stream]},function(a,b,c){this.stream1=a;this.stream2=b;this.transform=c},{iterator:function(){return a.kotlin.MergingStream.iterator$f(this)}},{iterator$f:function(f){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},function c(){c.baseInitializer.call(this);
this.iterator1=f.stream1.iterator();this.iterator2=f.stream2.iterator()},{computeNext:function(){this.iterator1.hasNext()&&this.iterator2.hasNext()?this.setNext_za3rmp$(f.transform(this.iterator1.next(),this.iterator2.next())):this.done()}})}}),FlatteningStream:b.createClass(function(){return[a.kotlin.Stream]},function(a,b){this.stream=a;this.transformer=b},{iterator:function(){return a.kotlin.FlatteningStream.iterator$f(this)}},{iterator$f:function(f){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},
function c(){c.baseInitializer.call(this);this.iterator=f.stream.iterator();this.itemIterator=null},{computeNext:function(){for(;null==this.itemIterator;)if(this.iterator.hasNext()){var a=this.iterator.next(),a=f.transformer(a).iterator();a.hasNext()&&(this.itemIterator=a)}else{this.done();break}a=this.itemIterator;null==a?this.done():(this.setNext_za3rmp$(a.next()),a.hasNext()||(this.itemIterator=null))}})}}),Multistream:b.createClass(function(){return[a.kotlin.Stream]},function(a){this.streams=
a},{iterator:function(){return a.kotlin.Multistream.iterator$f(this)}},{iterator$f:function(f){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},function c(){c.baseInitializer.call(this);this.iterator=f.streams.iterator();this.streamIterator=null},{computeNext:function(){for(;null==this.streamIterator;)if(this.iterator.hasNext()){var a=this.iterator.next().iterator();a.hasNext()&&(this.streamIterator=a)}else{this.done();break}a=this.streamIterator;null==a?this.done():(this.setNext_za3rmp$(a.next()),
a.hasNext()||(this.streamIterator=null))}})}}),LimitedStream:b.createClass(function(){return[a.kotlin.Stream]},function(a,b,c){void 0===b&&(b=!0);this.stream=a;this.stopWhen=b;this.predicate=c},{iterator:function(){return a.kotlin.LimitedStream.iterator$f(this)}},{iterator$f:function(f){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},function c(){c.baseInitializer.call(this);this.iterator=f.stream.iterator()},{computeNext:function(){if(this.iterator.hasNext()){var a=this.iterator.next();
b.equals(f.predicate(a),f.stopWhen)?this.done():this.setNext_za3rmp$(a)}else this.done()}})}}),FunctionStream:b.createClass(function(){return[a.kotlin.Stream]},function(a){this.producer=a},{iterator:function(){return a.kotlin.FunctionStream.iterator$f(this)}},{iterator$f:function(f){return b.createObject(function(){return[a.kotlin.support.AbstractIterator]},function c(){c.baseInitializer.call(this)},{computeNext:function(){var a=f.producer();null==a?this.done():this.setNext_za3rmp$(a)}})}}),stream_n8bj3p$:function(f){return new a.kotlin.FunctionStream(f)},
stream_74f9dl$:function(f,b){return a.kotlin.stream_n8bj3p$(a.kotlin.toGenerator_n1mtj3$(b,f))},stdlib_emptyListClass:b.createClass(function(){return[a.kotlin.List]},null),stdlib_emptyList:function(){return a.kotlin.stdlib_emptyList_w9bu57$},stdlib_emptyMapClass:b.createClass(function(){return[a.kotlin.Map]},null),stdlib_emptyMap:function(){return a.kotlin.stdlib_emptyMap_h2vi7z$},listOf_mzrxf8$:function(f){return 0===f.length?a.kotlin.stdlib_emptyList():a.kotlin.arrayListOf_mzrxf8$(f)},listOf:function(){return a.kotlin.stdlib_emptyList()},
mapOf_mzrxf8$:function(f){return 0===f.length?a.kotlin.stdlib_emptyMap():a.kotlin.hashMapOf_mzrxf8$(f)},mapOf:function(){return a.kotlin.stdlib_emptyMap()},arrayListOf_mzrxf8$:function(f){return a.kotlin.toCollection_xpmo5j$(f,new b.ArrayList(f.length))},hashSetOf_mzrxf8$:function(f){return a.kotlin.toCollection_xpmo5j$(f,new b.ComplexHashSet(f.length))},hashMapOf_mzrxf8$:function(f){var d=new b.ComplexHashMap(f.length);a.kotlin.putAll_nvpytz$(d,f);return d},get_size_1:{value:function(a){return a.size()}},
get_empty_0:{value:function(a){return a.isEmpty()}},get_indices:{value:function(f){return new b.NumberRange(0,a.kotlin.get_size_1(f)-1)}},get_indices_0:{value:function(a){return new b.NumberRange(0,a-1)}},isNotEmpty_tkvw3h$:function(a){return!a.isEmpty()},get_notEmpty:{value:function(f){return a.kotlin.isNotEmpty_tkvw3h$(f)}},orEmpty_tkvw3h$:function(f){return null!=f?f:a.kotlin.stdlib_emptyList()},orEmpty_mtvwn1$:function(f){return null!=f?f:a.kotlin.stdlib_emptyList()},get_first:{value:function(f){return a.kotlin.get_head(f)}},
get_last:{value:function(f){var b=a.kotlin.get_size_1(f);return 0<b?f.get_za3lpa$(b-1):null}},get_lastIndex_8:{value:function(f){return a.kotlin.get_size_1(f)-1}},get_head:{value:function(f){return a.kotlin.isNotEmpty_tkvw3h$(f)?f.get_za3lpa$(0):null}},get_tail:{value:function(f){return a.kotlin.drop_odt3s5$(f,1)}},addAll_wtmfso$:function(f,d){if(b.isType(d,a.kotlin.Collection))f.addAll_xeylzf$(d);else for(var c=d.iterator();c.hasNext();){var e=c.next();f.add_za3rmp$(e)}},addAll_ngcqne$:function(a,
b){for(var c=b.iterator();c.hasNext();){var e=c.next();a.add_za3rmp$(e)}},addAll_jl7u2r$:function(a,b){var c,e;c=b.length;for(e=0;e!==c;++e)a.add_za3rmp$(b[e])},removeAll_wtmfso$:function(f,d){if(b.isType(d,a.kotlin.Collection))f.removeAll_xeylzf$(d);else for(var c=d.iterator();c.hasNext();){var e=c.next();f.remove_za3rmp$(e)}},removeAll_ngcqne$:function(a,b){for(var c=b.iterator();c.hasNext();){var e=c.next();a.remove_za3rmp$(e)}},removeAll_jl7u2r$:function(a,b){var c,e;c=b.length;for(e=0;e!==c;++e)a.remove_za3rmp$(b[e])},
retainAll_wtmfso$:function(f,d){b.isType(d,a.kotlin.Collection)?f.retainAll_xeylzf$(d):f.retainAll_xeylzf$(a.kotlin.toSet_h3panj$(d))},retainAll_jl7u2r$:function(f,b){f.retainAll_xeylzf$(a.kotlin.toSet_2hx8bi$(b))},drop_fdw77o$:function(a,d){if(d>=a.length)return new b.ArrayList;var c=0,e=new b.ArrayList(a.length-d),g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];c++>=d&&e.add_za3rmp$(x)}return e},drop_rz0vgy$:function(a,d){if(d>=a.length)return new b.ArrayList;for(var c=0,e=new b.ArrayList(a.length-
d),g=b.arrayIterator(a);g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_ucmip8$:function(a,d){if(d>=a.length)return new b.ArrayList;for(var c=0,e=new b.ArrayList(a.length-d),g=b.arrayIterator(a);g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_cwi0e2$:function(a,d){if(d>=a.length)return new b.ArrayList;for(var c=0,e=new b.ArrayList(a.length-d),g=b.arrayIterator(a);g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_3qx2rv$:function(a,d){if(d>=
a.length)return new b.ArrayList;for(var c=0,e=new b.ArrayList(a.length-d),g=b.arrayIterator(a);g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_2e964m$:function(a,d){if(d>=a.length)return new b.ArrayList;for(var c=0,e=new b.ArrayList(a.length-d),g=b.arrayIterator(a);g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_tb5gmf$:function(a,d){if(d>=a.length)return new b.ArrayList;var c=0,e=new b.ArrayList(a.length-d),g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];c++>=
d&&e.add_za3rmp$(x)}return e},drop_x09c4g$:function(a,d){if(d>=a.length)return new b.ArrayList;for(var c=0,e=new b.ArrayList(a.length-d),g=b.arrayIterator(a);g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_7naycm$:function(a,d){if(d>=a.length)return new b.ArrayList;for(var c=0,e=new b.ArrayList(a.length-d),g=b.arrayIterator(a);g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_odt3s5$:function(f,d){if(d>=a.kotlin.get_size_1(f))return new b.ArrayList;for(var c=
0,e=new b.ArrayList(a.kotlin.get_size_1(f)-d),g=f.iterator();g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_eq3vf5$:function(a,d){for(var c=0,e=new b.ArrayList,g=a.iterator();g.hasNext();){var k=g.next();c++>=d&&e.add_za3rmp$(k)}return e},drop_9ip83h$f:function(a,b){return function(c){return a.v++>=b}},drop_9ip83h$:function(f,b){return new a.kotlin.FilteringStream(f,void 0,a.kotlin.drop_9ip83h$f({v:0},b))},drop_n7iutu$:function(f,b){return f.substring(Math.min(b,a.kotlin.get_size_0(f)))},
dropWhile_de9h66$:function(a,d){var c=!1,e=new b.ArrayList,g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];c?e.add_za3rmp$(x):d(x)||(e.add_za3rmp$(x),c=!0)}return e},dropWhile_50zxbw$:function(a,d){for(var c=!1,e=new b.ArrayList,g=b.arrayIterator(a);g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),c=!0)}return e},dropWhile_x245au$:function(a,d){for(var c=!1,e=new b.ArrayList,g=b.arrayIterator(a);g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),c=!0)}return e},
dropWhile_h5ed0c$:function(a,d){for(var c=!1,e=new b.ArrayList,g=b.arrayIterator(a);g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),c=!0)}return e},dropWhile_24jijj$:function(a,d){for(var c=!1,e=new b.ArrayList,g=b.arrayIterator(a);g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),c=!0)}return e},dropWhile_im8pe8$:function(a,d){for(var c=!1,e=new b.ArrayList,g=b.arrayIterator(a);g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),c=
!0)}return e},dropWhile_1xntkt$:function(a,d){var c=!1,e=new b.ArrayList,g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];c?e.add_za3rmp$(x):d(x)||(e.add_za3rmp$(x),c=!0)}return e},dropWhile_3cuuyy$:function(a,d){for(var c=!1,e=new b.ArrayList,g=b.arrayIterator(a);g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),c=!0)}return e},dropWhile_p67zio$:function(a,d){for(var c=!1,e=new b.ArrayList,g=b.arrayIterator(a);g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),
c=!0)}return e},dropWhile_vqr6wr$:function(a,d){for(var c=!1,e=new b.ArrayList,g=a.iterator();g.hasNext();){var k=g.next();c?e.add_za3rmp$(k):d(k)||(e.add_za3rmp$(k),c=!0)}return e},dropWhile_9fpnal$f:function(a,b){return function(c){return a.v?!0:b(c)?!1:a.v=!0}},dropWhile_9fpnal$:function(f,b){return new a.kotlin.FilteringStream(f,void 0,a.kotlin.dropWhile_9fpnal$f({v:!1},b))},dropWhile_t73kuc$:function(a,b){var c;c=a.length-1+1;for(var e=0;e!==c;e++)if(!b(a.charAt(e)))return a.substring(e);return""},
filter_de9h66$:function(f,d){return a.kotlin.filterTo_1jm7xb$(f,new b.ArrayList,d)},filter_50zxbw$:function(f,d){return a.kotlin.filterTo_uoz9bj$(f,new b.ArrayList,d)},filter_x245au$:function(f,d){return a.kotlin.filterTo_o451x3$(f,new b.ArrayList,d)},filter_h5ed0c$:function(f,d){return a.kotlin.filterTo_xryfpz$(f,new b.ArrayList,d)},filter_24jijj$:function(f,d){return a.kotlin.filterTo_6s9ff2$(f,new b.ArrayList,d)},filter_im8pe8$:function(f,d){return a.kotlin.filterTo_lbhsbh$(f,new b.ArrayList,d)},
filter_1xntkt$:function(f,d){return a.kotlin.filterTo_4m2m1i$(f,new b.ArrayList,d)},filter_3cuuyy$:function(f,d){return a.kotlin.filterTo_ru2r$(f,new b.ArrayList,d)},filter_p67zio$:function(f,d){return a.kotlin.filterTo_wion7n$(f,new b.ArrayList,d)},filter_vqr6wr$:function(f,d){return a.kotlin.filterTo_ywx4y6$(f,new b.ArrayList,d)},filter_gld13f$:function(f,d){return a.kotlin.filterTo_inv7mm$(f,new b.ArrayList,d)},filter_9fpnal$:function(f,b){return new a.kotlin.FilteringStream(f,!0,b)},filter_t73kuc$:function(f,
d){return a.kotlin.filterTo_2ngy80$(f,new b.StringBuilder,d).toString()},filterNot_de9h66$:function(f,d){return a.kotlin.filterNotTo_1jm7xb$(f,new b.ArrayList,d)},filterNot_50zxbw$:function(f,d){return a.kotlin.filterNotTo_uoz9bj$(f,new b.ArrayList,d)},filterNot_x245au$:function(f,d){return a.kotlin.filterNotTo_o451x3$(f,new b.ArrayList,d)},filterNot_h5ed0c$:function(f,d){return a.kotlin.filterNotTo_xryfpz$(f,new b.ArrayList,d)},filterNot_24jijj$:function(f,d){return a.kotlin.filterNotTo_6s9ff2$(f,
new b.ArrayList,d)},filterNot_im8pe8$:function(f,d){return a.kotlin.filterNotTo_lbhsbh$(f,new b.ArrayList,d)},filterNot_1xntkt$:function(f,d){return a.kotlin.filterNotTo_4m2m1i$(f,new b.ArrayList,d)},filterNot_3cuuyy$:function(f,d){return a.kotlin.filterNotTo_ru2r$(f,new b.ArrayList,d)},filterNot_p67zio$:function(f,d){return a.kotlin.filterNotTo_wion7n$(f,new b.ArrayList,d)},filterNot_vqr6wr$:function(f,d){return a.kotlin.filterNotTo_ywx4y6$(f,new b.ArrayList,d)},filterNot_gld13f$:function(f,d){return a.kotlin.filterNotTo_inv7mm$(f,
new b.ArrayList,d)},filterNot_9fpnal$:function(f,b){return new a.kotlin.FilteringStream(f,!1,b)},filterNot_t73kuc$:function(f,d){return a.kotlin.filterNotTo_2ngy80$(f,new b.StringBuilder,d).toString()},filterNotNull_2hx8bi$:function(f){return a.kotlin.filterNotNullTo_xpmo5j$(f,new b.ArrayList)},filterNotNull_h3panj$:function(f){return a.kotlin.filterNotNullTo_4jj70a$(f,new b.ArrayList)},filterNotNull_pdnvbz$f:function(a){return null==a},filterNotNull_pdnvbz$:function(f){return new a.kotlin.FilteringStream(f,
!1,a.kotlin.filterNotNull_pdnvbz$f)},filterNotNullTo_xpmo5j$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e){var g=a[e];null!=g&&b.add_za3rmp$(g)}return b},filterNotNullTo_4jj70a$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();null!=e&&b.add_za3rmp$(e)}return b},filterNotNullTo_791eew$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();null!=e&&b.add_za3rmp$(e)}return b},filterNotTo_1jm7xb$:function(a,b,c){var e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];c(k)||
b.add_za3rmp$(k)}return b},filterNotTo_uoz9bj$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)||d.add_za3rmp$(e)}return d},filterNotTo_o451x3$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)||d.add_za3rmp$(e)}return d},filterNotTo_xryfpz$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)||d.add_za3rmp$(e)}return d},filterNotTo_6s9ff2$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)||d.add_za3rmp$(e)}return d},
filterNotTo_lbhsbh$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)||d.add_za3rmp$(e)}return d},filterNotTo_4m2m1i$:function(a,b,c){var e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];c(k)||b.add_za3rmp$(k)}return b},filterNotTo_ru2r$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)||d.add_za3rmp$(e)}return d},filterNotTo_wion7n$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)||d.add_za3rmp$(e)}return d},filterNotTo_ywx4y6$:function(a,
b,c){for(a=a.iterator();a.hasNext();){var e=a.next();c(e)||b.add_za3rmp$(e)}return b},filterNotTo_inv7mm$:function(f,b,c){for(f=a.kotlin.iterator_s8ckw1$(f);f.hasNext();){var e=f.next();c(e)||b.add_za3rmp$(e)}return b},filterNotTo_ggat1c$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();c(e)||b.add_za3rmp$(e)}return b},filterNotTo_2ngy80$:function(f,b,c){for(f=a.kotlin.iterator_gw00vq$(f);f.hasNext();){var e=f.next();c(e)||b.append(e)}return b},filterTo_1jm7xb$:function(a,b,c){var e,
g;e=a.length;for(g=0;g!==e;++g){var k=a[g];c(k)&&b.add_za3rmp$(k)}return b},filterTo_uoz9bj$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)&&d.add_za3rmp$(e)}return d},filterTo_o451x3$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)&&d.add_za3rmp$(e)}return d},filterTo_xryfpz$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)&&d.add_za3rmp$(e)}return d},filterTo_6s9ff2$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=
a.next();c(e)&&d.add_za3rmp$(e)}return d},filterTo_lbhsbh$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)&&d.add_za3rmp$(e)}return d},filterTo_4m2m1i$:function(a,b,c){var e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];c(k)&&b.add_za3rmp$(k)}return b},filterTo_ru2r$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)&&d.add_za3rmp$(e)}return d},filterTo_wion7n$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();c(e)&&d.add_za3rmp$(e)}return d},
filterTo_ywx4y6$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();c(e)&&b.add_za3rmp$(e)}return b},filterTo_inv7mm$:function(f,b,c){for(f=a.kotlin.iterator_s8ckw1$(f);f.hasNext();){var e=f.next();c(e)&&b.add_za3rmp$(e)}return b},filterTo_ggat1c$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();c(e)&&b.add_za3rmp$(e)}return b},filterTo_2ngy80$:function(a,b,c){var e;e=a.length-1+1;for(var g=0;g!==e;g++){var k=a.charAt(g);c(k)&&b.append(k)}return b},slice_qxrbi5$:function(a,
d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_34aosx$:function(a,d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_dto1g5$:function(a,d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_ldb6x3$:function(a,d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_5ya7ho$:function(a,
d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_t349z9$:function(a,d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_3cdrzs$:function(a,d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_cc6qan$:function(a,d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_w98n8l$:function(a,
d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a[g])}return c},slice_h9kosk$:function(a,d){for(var c=new b.ArrayList,e=d.iterator();e.hasNext();){var g=e.next();c.add_za3rmp$(a.get_za3lpa$(g))}return c},slice_n9t38v$:function(a,d){for(var c=new b.StringBuilder,e=d.iterator();e.hasNext();){var g=e.next();c.append(a.charAt(g))}return c.toString()},take_fdw77o$:function(a,d){var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k,x;k=a.length;for(x=0;x!==k;++x){var z=
a[x];if(c++===e)break;g.add_za3rmp$(z)}return g},take_rz0vgy$:function(a,d){for(var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k=b.arrayIterator(a);k.hasNext();){var x=k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_ucmip8$:function(a,d){for(var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k=b.arrayIterator(a);k.hasNext();){var x=k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_cwi0e2$:function(a,d){for(var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k=b.arrayIterator(a);k.hasNext();){var x=
k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_3qx2rv$:function(a,d){for(var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k=b.arrayIterator(a);k.hasNext();){var x=k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_2e964m$:function(a,d){for(var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k=b.arrayIterator(a);k.hasNext();){var x=k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_tb5gmf$:function(a,d){var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k,x;k=a.length;
for(x=0;x!==k;++x){var z=a[x];if(c++===e)break;g.add_za3rmp$(z)}return g},take_x09c4g$:function(a,d){for(var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k=b.arrayIterator(a);k.hasNext();){var x=k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_7naycm$:function(a,d){for(var c=0,e=d>a.length?a.length:d,g=new b.ArrayList(e),k=b.arrayIterator(a);k.hasNext();){var x=k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_odt3s5$:function(f,d){for(var c=0,e=d>a.kotlin.get_size_1(f)?a.kotlin.get_size_1(f):
d,g=new b.ArrayList(e),k=f.iterator();k.hasNext();){var x=k.next();if(c++===e)break;g.add_za3rmp$(x)}return g},take_eq3vf5$:function(a,d){for(var c=0,e=new b.ArrayList(d),g=a.iterator();g.hasNext();){var k=g.next();if(c++===d)break;e.add_za3rmp$(k)}return e},take_9ip83h$f:function(a,b){return function(c){return a.v++===b}},take_9ip83h$:function(f,b){return new a.kotlin.LimitedStream(f,void 0,a.kotlin.take_9ip83h$f({v:0},b))},take_n7iutu$:function(f,b){return f.substring(0,Math.min(b,a.kotlin.get_size_0(f)))},
takeWhile_de9h66$:function(a,d){var c=new b.ArrayList,e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];if(!d(k))break;c.add_za3rmp$(k)}return c},takeWhile_50zxbw$:function(a,d){for(var c=new b.ArrayList,e=b.arrayIterator(a);e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_x245au$:function(a,d){for(var c=new b.ArrayList,e=b.arrayIterator(a);e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_h5ed0c$:function(a,d){for(var c=new b.ArrayList,e=
b.arrayIterator(a);e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_24jijj$:function(a,d){for(var c=new b.ArrayList,e=b.arrayIterator(a);e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_im8pe8$:function(a,d){for(var c=new b.ArrayList,e=b.arrayIterator(a);e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_1xntkt$:function(a,d){var c=new b.ArrayList,e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];if(!d(k))break;
c.add_za3rmp$(k)}return c},takeWhile_3cuuyy$:function(a,d){for(var c=new b.ArrayList,e=b.arrayIterator(a);e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_p67zio$:function(a,d){for(var c=new b.ArrayList,e=b.arrayIterator(a);e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_vqr6wr$:function(a,d){for(var c=new b.ArrayList,e=a.iterator();e.hasNext();){var g=e.next();if(!d(g))break;c.add_za3rmp$(g)}return c},takeWhile_9fpnal$:function(f,b){return new a.kotlin.LimitedStream(f,
!1,b)},takeWhile_t73kuc$:function(a,b){var c;c=a.length-1+1;for(var e=0;e!==c;e++)if(!b(a.charAt(e)))return a.substring(0,e);return a},stream_2hx8bi$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return b.arrayIterator(f)}})},stream_l1lu5s$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return b.arrayIterator(f)}})},stream_964n92$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},
null,{iterator:function(){return b.arrayIterator(f)}})},stream_355nu0$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return b.arrayIterator(f)}})},stream_bvy38t$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return b.arrayIterator(f)}})},stream_rjqrz0$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return b.arrayIterator(f)}})},stream_tmsbgp$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},
null,{iterator:function(){return b.arrayIterator(f)}})},stream_se6h4y$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return b.arrayIterator(f)}})},stream_i2lc78$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return b.arrayIterator(f)}})},stream_h3panj$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return f.iterator()}})},stream_pdnvbz$:function(a){return a},
stream_pdl1w0$:function(f){return b.createObject(function(){return[a.kotlin.Stream]},null,{iterator:function(){return a.kotlin.iterator_gw00vq$(f)}})},requireNoNulls_2hx8bi$:function(a){var d,c;d=a.length;for(c=0;c!==d;++c)if(null==a[c])throw new b.IllegalArgumentException("null element found in "+a);return a},requireNoNulls_h3panj$:function(a){for(var d=a.iterator();d.hasNext();)if(null==d.next())throw new b.IllegalArgumentException("null element found in "+a);return a},requireNoNulls_mtvwn1$:function(a){for(var d=
a.iterator();d.hasNext();)if(null==d.next())throw new b.IllegalArgumentException("null element found in "+a);return a},requireNoNulls_pdnvbz$f:function(a){return function(d){if(null==d)throw new b.IllegalArgumentException("null element found in "+a);return!0}},requireNoNulls_pdnvbz$:function(f){return new a.kotlin.FilteringStream(f,void 0,a.kotlin.requireNoNulls_pdnvbz$f(f))},flatMap_de9h66$:function(f,d){return a.kotlin.flatMapTo_1jm7xb$(f,new b.ArrayList,d)},flatMap_50zxbw$:function(f,d){return a.kotlin.flatMapTo_uoz9bj$(f,
new b.ArrayList,d)},flatMap_x245au$:function(f,d){return a.kotlin.flatMapTo_o451x3$(f,new b.ArrayList,d)},flatMap_h5ed0c$:function(f,d){return a.kotlin.flatMapTo_xryfpz$(f,new b.ArrayList,d)},flatMap_24jijj$:function(f,d){return a.kotlin.flatMapTo_6s9ff2$(f,new b.ArrayList,d)},flatMap_im8pe8$:function(f,d){return a.kotlin.flatMapTo_lbhsbh$(f,new b.ArrayList,d)},flatMap_1xntkt$:function(f,d){return a.kotlin.flatMapTo_4m2m1i$(f,new b.ArrayList,d)},flatMap_3cuuyy$:function(f,d){return a.kotlin.flatMapTo_ru2r$(f,
new b.ArrayList,d)},flatMap_p67zio$:function(f,d){return a.kotlin.flatMapTo_wion7n$(f,new b.ArrayList,d)},flatMap_vqr6wr$:function(f,d){return a.kotlin.flatMapTo_ywx4y6$(f,new b.ArrayList,d)},flatMap_gld13f$:function(f,d){return a.kotlin.flatMapTo_inv7mm$(f,new b.ArrayList,d)},flatMap_t73kuc$:function(f,d){return a.kotlin.flatMapTo_caazm9$(f,new b.ArrayList,d)},flatMap_9fpnal$:function(f,b){return new a.kotlin.FlatteningStream(f,b)},flatMapTo_1jm7xb$:function(f,b,c){var e,g;e=f.length;for(g=0;g!==
e;++g){var k=c(f[g]);a.kotlin.addAll_wtmfso$(b,k)}return b},flatMapTo_uoz9bj$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(d,e)}return d},flatMapTo_o451x3$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(d,e)}return d},flatMapTo_xryfpz$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(d,e)}return d},flatMapTo_6s9ff2$:function(f,d,c){for(f=
b.arrayIterator(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(d,e)}return d},flatMapTo_lbhsbh$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(d,e)}return d},flatMapTo_4m2m1i$:function(f,b,c){var e,g;e=f.length;for(g=0;g!==e;++g){var k=c(f[g]);a.kotlin.addAll_wtmfso$(b,k)}return b},flatMapTo_ru2r$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(d,e)}return d},flatMapTo_wion7n$:function(f,
d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(d,e)}return d},flatMapTo_ywx4y6$:function(f,b,c){for(f=f.iterator();f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(b,e)}return b},flatMapTo_inv7mm$:function(f,b,c){for(f=a.kotlin.iterator_s8ckw1$(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(b,e)}return b},flatMapTo_caazm9$:function(f,b,c){for(f=a.kotlin.iterator_gw00vq$(f);f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_wtmfso$(b,
e)}return b},flatMapTo_ggat1c$:function(f,b,c){for(f=f.iterator();f.hasNext();){var e=f.next(),e=c(e);a.kotlin.addAll_ngcqne$(b,e)}return b},groupBy_de9h66$:function(f,d){return a.kotlin.groupByTo_dmnozt$(f,new b.ComplexHashMap,d)},groupBy_50zxbw$:function(f,d){return a.kotlin.groupByTo_7i5ojf$(f,new b.ComplexHashMap,d)},groupBy_x245au$:function(f,d){return a.kotlin.groupByTo_du5x9d$(f,new b.ComplexHashMap,d)},groupBy_h5ed0c$:function(f,d){return a.kotlin.groupByTo_4mj9lf$(f,new b.ComplexHashMap,
d)},groupBy_24jijj$:function(f,d){return a.kotlin.groupByTo_yr676w$(f,new b.ComplexHashMap,d)},groupBy_im8pe8$:function(f,d){return a.kotlin.groupByTo_fktjsp$(f,new b.ComplexHashMap,d)},groupBy_1xntkt$:function(f,d){return a.kotlin.groupByTo_8qaat0$(f,new b.ComplexHashMap,d)},groupBy_3cuuyy$:function(f,d){return a.kotlin.groupByTo_rnq9xv$(f,new b.ComplexHashMap,d)},groupBy_p67zio$:function(f,d){return a.kotlin.groupByTo_yb8vhj$(f,new b.ComplexHashMap,d)},groupBy_vqr6wr$:function(f,d){return a.kotlin.groupByTo_cyhgqk$(f,
new b.ComplexHashMap,d)},groupBy_gld13f$:function(f,d){return a.kotlin.groupByTo_7qivbo$(f,new b.ComplexHashMap,d)},groupBy_9fpnal$:function(f,d){return a.kotlin.groupByTo_fsw8ae$(f,new b.ComplexHashMap,d)},groupBy_t73kuc$:function(f,d){return a.kotlin.groupByTo_16syit$(f,new b.ComplexHashMap,d)},groupByTo_dmnozt$f:function(){return new b.ArrayList},groupByTo_dmnozt$:function(f,b,c){var e,g;e=f.length;for(g=0;g!==e;++g){var k=f[g],x=c(k);a.kotlin.getOrPut_ynyybx$(b,x,a.kotlin.groupByTo_dmnozt$f).add_za3rmp$(k)}return b},
groupByTo_7i5ojf$f:function(){return new b.ArrayList},groupByTo_7i5ojf$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(d,g,a.kotlin.groupByTo_7i5ojf$f).add_za3rmp$(e)}return d},groupByTo_du5x9d$f:function(){return new b.ArrayList},groupByTo_du5x9d$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(d,g,a.kotlin.groupByTo_du5x9d$f).add_za3rmp$(e)}return d},groupByTo_4mj9lf$f:function(){return new b.ArrayList},
groupByTo_4mj9lf$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(d,g,a.kotlin.groupByTo_4mj9lf$f).add_za3rmp$(e)}return d},groupByTo_yr676w$f:function(){return new b.ArrayList},groupByTo_yr676w$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(d,g,a.kotlin.groupByTo_yr676w$f).add_za3rmp$(e)}return d},groupByTo_fktjsp$f:function(){return new b.ArrayList},groupByTo_fktjsp$:function(f,d,c){for(f=
b.arrayIterator(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(d,g,a.kotlin.groupByTo_fktjsp$f).add_za3rmp$(e)}return d},groupByTo_8qaat0$f:function(){return new b.ArrayList},groupByTo_8qaat0$:function(f,b,c){var e,g;e=f.length;for(g=0;g!==e;++g){var k=f[g],x=c(k);a.kotlin.getOrPut_ynyybx$(b,x,a.kotlin.groupByTo_8qaat0$f).add_za3rmp$(k)}return b},groupByTo_rnq9xv$f:function(){return new b.ArrayList},groupByTo_rnq9xv$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),
g=c(e);a.kotlin.getOrPut_ynyybx$(d,g,a.kotlin.groupByTo_rnq9xv$f).add_za3rmp$(e)}return d},groupByTo_yb8vhj$f:function(){return new b.ArrayList},groupByTo_yb8vhj$:function(f,d,c){for(f=b.arrayIterator(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(d,g,a.kotlin.groupByTo_yb8vhj$f).add_za3rmp$(e)}return d},groupByTo_cyhgqk$f:function(){return new b.ArrayList},groupByTo_cyhgqk$:function(f,b,c){for(f=f.iterator();f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(b,g,a.kotlin.groupByTo_cyhgqk$f).add_za3rmp$(e)}return b},
groupByTo_7qivbo$f:function(){return new b.ArrayList},groupByTo_7qivbo$:function(f,b,c){for(f=a.kotlin.iterator_s8ckw1$(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(b,g,a.kotlin.groupByTo_7qivbo$f).add_za3rmp$(e)}return b},groupByTo_fsw8ae$f:function(){return new b.ArrayList},groupByTo_fsw8ae$:function(f,b,c){for(f=f.iterator();f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(b,g,a.kotlin.groupByTo_fsw8ae$f).add_za3rmp$(e)}return b},groupByTo_16syit$f:function(){return new b.ArrayList},
groupByTo_16syit$:function(f,b,c){for(f=a.kotlin.iterator_gw00vq$(f);f.hasNext();){var e=f.next(),g=c(e);a.kotlin.getOrPut_ynyybx$(b,g,a.kotlin.groupByTo_16syit$f).add_za3rmp$(e)}return b},map_de9h66$:function(f,d){return a.kotlin.mapTo_1jm7xb$(f,new b.ArrayList,d)},map_50zxbw$:function(f,d){return a.kotlin.mapTo_uoz9bj$(f,new b.ArrayList,d)},map_x245au$:function(f,d){return a.kotlin.mapTo_o451x3$(f,new b.ArrayList,d)},map_h5ed0c$:function(f,d){return a.kotlin.mapTo_xryfpz$(f,new b.ArrayList,d)},
map_24jijj$:function(f,d){return a.kotlin.mapTo_6s9ff2$(f,new b.ArrayList,d)},map_im8pe8$:function(f,d){return a.kotlin.mapTo_lbhsbh$(f,new b.ArrayList,d)},map_1xntkt$:function(f,d){return a.kotlin.mapTo_4m2m1i$(f,new b.ArrayList,d)},map_3cuuyy$:function(f,d){return a.kotlin.mapTo_ru2r$(f,new b.ArrayList,d)},map_p67zio$:function(f,d){return a.kotlin.mapTo_wion7n$(f,new b.ArrayList,d)},map_vqr6wr$:function(f,d){return a.kotlin.mapTo_ywx4y6$(f,new b.ArrayList,d)},map_gld13f$:function(f,d){return a.kotlin.mapTo_inv7mm$(f,
new b.ArrayList,d)},map_9fpnal$:function(f,b){return new a.kotlin.TransformingStream(f,b)},map_t73kuc$:function(f,d){return a.kotlin.mapTo_caazm9$(f,new b.ArrayList,d)},mapNotNull_de9h66$:function(f,d){return a.kotlin.mapNotNullTo_1jm7xb$(f,new b.ArrayList,d)},mapNotNull_vqr6wr$:function(f,d){return a.kotlin.mapNotNullTo_ywx4y6$(f,new b.ArrayList,d)},mapNotNull_9fpnal$f:function(a){return null==a},mapNotNull_9fpnal$:function(f,b){return new a.kotlin.TransformingStream(new a.kotlin.FilteringStream(f,
!1,a.kotlin.mapNotNull_9fpnal$f),b)},mapNotNullTo_1jm7xb$:function(a,b,c){var e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];null!=k&&b.add_za3rmp$(c(k))}return b},mapNotNullTo_ywx4y6$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();null!=e&&b.add_za3rmp$(c(e))}return b},mapNotNullTo_ggat1c$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();null!=e&&b.add_za3rmp$(c(e))}return b},mapTo_1jm7xb$:function(a,b,c){var e,g;e=a.length;for(g=0;g!==e;++g)b.add_za3rmp$(c(a[g]));return b},
mapTo_uoz9bj$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d.add_za3rmp$(c(e))}return d},mapTo_o451x3$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d.add_za3rmp$(c(e))}return d},mapTo_xryfpz$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d.add_za3rmp$(c(e))}return d},mapTo_6s9ff2$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d.add_za3rmp$(c(e))}return d},mapTo_lbhsbh$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=
a.next();d.add_za3rmp$(c(e))}return d},mapTo_4m2m1i$:function(a,b,c){var e,g;e=a.length;for(g=0;g!==e;++g)b.add_za3rmp$(c(a[g]));return b},mapTo_ru2r$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d.add_za3rmp$(c(e))}return d},mapTo_wion7n$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d.add_za3rmp$(c(e))}return d},mapTo_ywx4y6$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();b.add_za3rmp$(c(e))}return b},mapTo_inv7mm$:function(f,b,c){for(f=
a.kotlin.iterator_s8ckw1$(f);f.hasNext();){var e=f.next();b.add_za3rmp$(c(e))}return b},mapTo_ggat1c$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();b.add_za3rmp$(c(e))}return b},mapTo_caazm9$:function(f,b,c){for(f=a.kotlin.iterator_gw00vq$(f);f.hasNext();){var e=f.next();b.add_za3rmp$(c(e))}return b},withIndices_2hx8bi$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_2hx8bi$:function(f){return a.kotlin.mapTo_1jm7xb$(f,new b.ArrayList,a.kotlin.withIndices_2hx8bi$f({v:0}))},
withIndices_l1lu5s$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_l1lu5s$:function(f){return a.kotlin.mapTo_uoz9bj$(f,new b.ArrayList,a.kotlin.withIndices_l1lu5s$f({v:0}))},withIndices_964n92$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_964n92$:function(f){return a.kotlin.mapTo_o451x3$(f,new b.ArrayList,a.kotlin.withIndices_964n92$f({v:0}))},withIndices_355nu0$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,
b)}},withIndices_355nu0$:function(f){return a.kotlin.mapTo_xryfpz$(f,new b.ArrayList,a.kotlin.withIndices_355nu0$f({v:0}))},withIndices_bvy38t$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_bvy38t$:function(f){return a.kotlin.mapTo_6s9ff2$(f,new b.ArrayList,a.kotlin.withIndices_bvy38t$f({v:0}))},withIndices_rjqrz0$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_rjqrz0$:function(f){return a.kotlin.mapTo_lbhsbh$(f,new b.ArrayList,
a.kotlin.withIndices_rjqrz0$f({v:0}))},withIndices_tmsbgp$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_tmsbgp$:function(f){return a.kotlin.mapTo_4m2m1i$(f,new b.ArrayList,a.kotlin.withIndices_tmsbgp$f({v:0}))},withIndices_se6h4y$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_se6h4y$:function(f){return a.kotlin.mapTo_ru2r$(f,new b.ArrayList,a.kotlin.withIndices_se6h4y$f({v:0}))},withIndices_i2lc78$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,
b)}},withIndices_i2lc78$:function(f){return a.kotlin.mapTo_wion7n$(f,new b.ArrayList,a.kotlin.withIndices_i2lc78$f({v:0}))},withIndices_h3panj$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_h3panj$:function(f){return a.kotlin.mapTo_ywx4y6$(f,new b.ArrayList,a.kotlin.withIndices_h3panj$f({v:0}))},withIndices_pdnvbz$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_pdnvbz$:function(f){return new a.kotlin.TransformingStream(f,a.kotlin.withIndices_pdnvbz$f({v:0}))},
withIndices_pdl1w0$f:function(f){return function(b){return a.kotlin.to_l1ob02$(f.v++,b)}},withIndices_pdl1w0$:function(f){return a.kotlin.mapTo_caazm9$(f,new b.ArrayList,a.kotlin.withIndices_pdl1w0$f({v:0}))},distinct_2hx8bi$:function(f){return a.kotlin.toMutableSet_2hx8bi$(f)},distinct_l1lu5s$:function(f){return a.kotlin.toMutableSet_l1lu5s$(f)},distinct_964n92$:function(f){return a.kotlin.toMutableSet_964n92$(f)},distinct_355nu0$:function(f){return a.kotlin.toMutableSet_355nu0$(f)},distinct_bvy38t$:function(f){return a.kotlin.toMutableSet_bvy38t$(f)},
distinct_rjqrz0$:function(f){return a.kotlin.toMutableSet_rjqrz0$(f)},distinct_tmsbgp$:function(f){return a.kotlin.toMutableSet_tmsbgp$(f)},distinct_se6h4y$:function(f){return a.kotlin.toMutableSet_se6h4y$(f)},distinct_i2lc78$:function(f){return a.kotlin.toMutableSet_i2lc78$(f)},distinct_h3panj$:function(f){return a.kotlin.toMutableSet_h3panj$(f)},intersect_qxrbi5$:function(f,b){var c=a.kotlin.toMutableSet_2hx8bi$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_34aosx$:function(f,b){var c=
a.kotlin.toMutableSet_l1lu5s$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_dto1g5$:function(f,b){var c=a.kotlin.toMutableSet_964n92$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_ldb6x3$:function(f,b){var c=a.kotlin.toMutableSet_355nu0$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_5ya7ho$:function(f,b){var c=a.kotlin.toMutableSet_bvy38t$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_t349z9$:function(f,b){var c=a.kotlin.toMutableSet_rjqrz0$(f);a.kotlin.retainAll_wtmfso$(c,
b);return c},intersect_3cdrzs$:function(f,b){var c=a.kotlin.toMutableSet_tmsbgp$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_cc6qan$:function(f,b){var c=a.kotlin.toMutableSet_se6h4y$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_w98n8l$:function(f,b){var c=a.kotlin.toMutableSet_i2lc78$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},intersect_975xw0$:function(f,b){var c=a.kotlin.toMutableSet_h3panj$(f);a.kotlin.retainAll_wtmfso$(c,b);return c},subtract_qxrbi5$:function(f,b){var c=
a.kotlin.toMutableSet_2hx8bi$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_34aosx$:function(f,b){var c=a.kotlin.toMutableSet_l1lu5s$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_dto1g5$:function(f,b){var c=a.kotlin.toMutableSet_964n92$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_ldb6x3$:function(f,b){var c=a.kotlin.toMutableSet_355nu0$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_5ya7ho$:function(f,b){var c=a.kotlin.toMutableSet_bvy38t$(f);a.kotlin.removeAll_wtmfso$(c,
b);return c},subtract_t349z9$:function(f,b){var c=a.kotlin.toMutableSet_rjqrz0$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_3cdrzs$:function(f,b){var c=a.kotlin.toMutableSet_tmsbgp$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_cc6qan$:function(f,b){var c=a.kotlin.toMutableSet_se6h4y$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_w98n8l$:function(f,b){var c=a.kotlin.toMutableSet_i2lc78$(f);a.kotlin.removeAll_wtmfso$(c,b);return c},subtract_975xw0$:function(f,b){var c=a.kotlin.toMutableSet_h3panj$(f);
a.kotlin.removeAll_wtmfso$(c,b);return c},toMutableSet_2hx8bi$:function(a){var d=new b.LinkedHashSet(a.length),c,e;c=a.length;for(e=0;e!==c;++e)d.add_za3rmp$(a[e]);return d},toMutableSet_l1lu5s$:function(a){var d=new b.LinkedHashSet(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toMutableSet_964n92$:function(a){var d=new b.LinkedHashSet(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toMutableSet_355nu0$:function(a){var d=
new b.LinkedHashSet(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toMutableSet_bvy38t$:function(a){var d=new b.LinkedHashSet(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toMutableSet_rjqrz0$:function(a){var d=new b.LinkedHashSet(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toMutableSet_tmsbgp$:function(a){var d=new b.LinkedHashSet(a.length),c,e;c=a.length;for(e=
0;e!==c;++e)d.add_za3rmp$(a[e]);return d},toMutableSet_se6h4y$:function(a){var d=new b.LinkedHashSet(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toMutableSet_i2lc78$:function(a){var d=new b.LinkedHashSet(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toMutableSet_h3panj$:function(f){return b.isType(f,a.kotlin.Collection)?a.java.util.LinkedHashSet_xeylzf$(f):a.kotlin.toCollection_4jj70a$(f,new b.LinkedHashSet)},
union_qxrbi5$:function(f,b){var c=a.kotlin.toMutableSet_2hx8bi$(f);a.kotlin.addAll_wtmfso$(c,b);return c},union_34aosx$:function(f,b){var c=a.kotlin.toMutableSet_l1lu5s$(f);a.kotlin.addAll_wtmfso$(c,b);return c},union_dto1g5$:function(b,d){var c=a.kotlin.toMutableSet_964n92$(b);a.kotlin.addAll_wtmfso$(c,d);return c},union_ldb6x3$:function(b,d){var c=a.kotlin.toMutableSet_355nu0$(b);a.kotlin.addAll_wtmfso$(c,d);return c},union_5ya7ho$:function(b,d){var c=a.kotlin.toMutableSet_bvy38t$(b);a.kotlin.addAll_wtmfso$(c,
d);return c},union_t349z9$:function(b,d){var c=a.kotlin.toMutableSet_rjqrz0$(b);a.kotlin.addAll_wtmfso$(c,d);return c},union_3cdrzs$:function(b,d){var c=a.kotlin.toMutableSet_tmsbgp$(b);a.kotlin.addAll_wtmfso$(c,d);return c},union_cc6qan$:function(b,d){var c=a.kotlin.toMutableSet_se6h4y$(b);a.kotlin.addAll_wtmfso$(c,d);return c},union_w98n8l$:function(b,d){var c=a.kotlin.toMutableSet_i2lc78$(b);a.kotlin.addAll_wtmfso$(c,d);return c},union_975xw0$:function(b,d){var c=a.kotlin.toMutableSet_h3panj$(b);
a.kotlin.addAll_wtmfso$(c,d);return c},f:function(a,b){return function(c){b.v=a(c);return c}},toGenerator_n1mtj3$f:function(b,d){return function(){var c;return null!=(c=b.v)?a.kotlin.let_j58jph$(c,a.kotlin.f(d,b)):null}},toGenerator_n1mtj3$:function(b,d){return a.kotlin.toGenerator_n1mtj3$f({v:d},b)},to_l1ob02$:function(b,d){return new a.kotlin.Pair(b,d)},run_n8bj3p$:function(a){return a()},with_rc1ekn$:function(a,b){return b.call(a)},let_j58jph$:function(a,b){return b(a)},downTo_9q324c$:function(b,
d){return new a.kotlin.ByteProgression(b,d,-1)},downTo_9q3c22$:function(b,d){return new a.kotlin.CharProgression(b.toChar(),d,-1)},downTo_hl85u0$:function(b,d){return new a.kotlin.ShortProgression(b,d,-1)},downTo_y20kcl$:function(a,d){return new b.NumberProgression(a,d,-1)},downTo_9q98fk$:function(b,d){return new a.kotlin.LongProgression(b.toLong(),d,-(1).toLong())},downTo_he5dns$:function(b,d){return new a.kotlin.FloatProgression(b,d,-1)},downTo_tylosb$:function(b,d){return new a.kotlin.DoubleProgression(b,
d,-1)},downTo_sd8xje$:function(b,d){return new a.kotlin.CharProgression(b,d.toChar(),-1)},downTo_sd97h4$:function(b,d){return new a.kotlin.CharProgression(b,d,-1)},downTo_radrzu$:function(b,d){return new a.kotlin.ShortProgression(b.toShort(),d,-1)},downTo_v5vllf$:function(a,d){return new b.NumberProgression(a.toInt(),d,-1)},downTo_sdf3um$:function(b,d){return new a.kotlin.LongProgression(b.toLong(),d,-(1).toLong())},downTo_r3aztm$:function(b,d){return new a.kotlin.FloatProgression(b.toFloat(),d,-1)},
downTo_df7tnx$:function(b,d){return new a.kotlin.DoubleProgression(b.toDouble(),d,-1)},downTo_9r634a$:function(b,d){return new a.kotlin.ShortProgression(b,d,-1)},downTo_9r5t6k$:function(b,d){return new a.kotlin.ShortProgression(b,d.toShort(),-1)},downTo_i0qws2$:function(b,d){return new a.kotlin.ShortProgression(b,d,-1)},downTo_rt69vj$:function(a,d){return new b.NumberProgression(a,d,-1)},downTo_9qzwt2$:function(b,d){return new a.kotlin.LongProgression(b.toLong(),d,-(1).toLong())},downTo_i7toya$:function(b,
d){return new a.kotlin.FloatProgression(b,d,-1)},downTo_2lzxtr$:function(b,d){return new a.kotlin.DoubleProgression(b,d,-1)},downTo_2jcion$:function(a,d){return new b.NumberProgression(a,d,-1)},downTo_2jc8qx$:function(a,d){return new b.NumberProgression(a,d.toInt(),-1)},downTo_7dmh8l$:function(a,d){return new b.NumberProgression(a,d,-1)},downTo_rksjo2$:function(a,d){return new b.NumberProgression(a,d,-1)},downTo_2j6cdf$:function(b,d){return new a.kotlin.LongProgression(b.toLong(),d,-(1).toLong())},
downTo_7kp9et$:function(b,d){return new a.kotlin.FloatProgression(b,d,-1)},downTo_mmqya6$:function(b,d){return new a.kotlin.DoubleProgression(b,d,-1)},downTo_jzdo0$:function(b,d){return new a.kotlin.LongProgression(b,d.toLong(),-(1).toLong())},downTo_jznlq$:function(b,d){return new a.kotlin.LongProgression(b,d.toLong(),-(1).toLong())},downTo_hgibo4$:function(b,d){return new a.kotlin.LongProgression(b,d.toLong(),-(1).toLong())},downTo_mw85q1$:function(b,d){return new a.kotlin.LongProgression(b,d.toLong(),
-(1).toLong())},downTo_k5jz8$:function(b,d){return new a.kotlin.LongProgression(b,d,-(1).toLong())},downTo_h9fjhw$:function(b,d){return new a.kotlin.FloatProgression(b.toFloat(),d,-1)},downTo_y0unuv$:function(b,d){return new a.kotlin.DoubleProgression(b.toDouble(),d,-1)},downTo_kquaae$:function(b,d){return new a.kotlin.FloatProgression(b,d,-1)},downTo_kquk84$:function(b,d){return new a.kotlin.FloatProgression(b,d.toFloat(),-1)},downTo_433x66$:function(b,d){return new a.kotlin.FloatProgression(b,d,
-1)},downTo_jyaijj$:function(b,d){return new a.kotlin.FloatProgression(b,d,-1)},downTo_kr0glm$:function(b,d){return new a.kotlin.FloatProgression(b,d.toFloat(),-1)},downTo_3w14zy$:function(b,d){return new a.kotlin.FloatProgression(b,d,-1)},downTo_mdktgh$:function(b,d){return new a.kotlin.DoubleProgression(b,d,-1)},downTo_stl18b$:function(b,d){return new a.kotlin.DoubleProgression(b,d,-1)},downTo_stkral$:function(b,d){return new a.kotlin.DoubleProgression(b,d.toDouble(),-1)},downTo_u6e7j3$:function(b,
d){return new a.kotlin.DoubleProgression(b,d,-1)},downTo_aiyy8i$:function(b,d){return new a.kotlin.DoubleProgression(b,d,-1)},downTo_steux3$:function(b,d){return new a.kotlin.DoubleProgression(b,d.toDouble(),-1)},downTo_tzbfcv$:function(b,d){return new a.kotlin.DoubleProgression(b,d,-1)},downTo_541hxq$:function(b,d){return new a.kotlin.DoubleProgression(b,d,-1)},merge_91t4nf$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),
d.next()));return e},merge_zb2wxp$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_au6o65$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_resd0r$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&
d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_6lndoa$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_g5oapj$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_f32dm2$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);
for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_oi38kv$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_pn4jvt$:function(f,d,c){f=b.arrayIterator(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_tl80ny$:function(f,
d,c){f=f.iterator();d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_29xg59$:function(f,d,c){f=a.kotlin.iterator_gw00vq$(f);d=b.arrayIterator(d);for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_7bg1pg$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),
d.next()));return e},merge_vzyamu$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_r76i9w$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_d5bgvi$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&
d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_d6i5gz$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_y6emce$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_k6l5td$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&
d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_ksuah4$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_eqb4ua$:function(f,d,c){f=b.arrayIterator(f);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);f.hasNext()&&d.hasNext();)e.add_za3rmp$(c(f.next(),d.next()));return e},merge_hqmbqh$:function(b,d,c){b=b.iterator();d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);b.hasNext()&&
d.hasNext();)e.add_za3rmp$(c(b.next(),d.next()));return e},merge_q03f9y$:function(b,d,c){b=a.kotlin.iterator_gw00vq$(b);d=d.iterator();for(var e=a.kotlin.arrayListOf_mzrxf8$([]);b.hasNext()&&d.hasNext();)e.add_za3rmp$(c(b.next(),d.next()));return e},merge_28jw99$:function(b,d,c){return new a.kotlin.MergingStream(b,d,c)},partition_de9h66$:function(f,d){var c=new b.ArrayList,e=new b.ArrayList,g,k;g=f.length;for(k=0;k!==g;++k){var x=f[k];d(x)?c.add_za3rmp$(x):e.add_za3rmp$(x)}return new a.kotlin.Pair(c,
e)},partition_50zxbw$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=b.arrayIterator(f);g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_x245au$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=b.arrayIterator(f);g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_h5ed0c$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=b.arrayIterator(f);g.hasNext();){var k=
g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_24jijj$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=b.arrayIterator(f);g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_im8pe8$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=b.arrayIterator(f);g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_1xntkt$:function(f,d){var c=
new b.ArrayList,e=new b.ArrayList,g,k;g=f.length;for(k=0;k!==g;++k){var x=f[k];d(x)?c.add_za3rmp$(x):e.add_za3rmp$(x)}return new a.kotlin.Pair(c,e)},partition_3cuuyy$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=b.arrayIterator(f);g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_p67zio$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=b.arrayIterator(f);g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,
e)},partition_vqr6wr$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=f.iterator();g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_9fpnal$:function(f,d){for(var c=new b.ArrayList,e=new b.ArrayList,g=f.iterator();g.hasNext();){var k=g.next();d(k)?c.add_za3rmp$(k):e.add_za3rmp$(k)}return new a.kotlin.Pair(c,e)},partition_t73kuc$:function(f,d){for(var c=new b.StringBuilder,e=new b.StringBuilder,g=a.kotlin.iterator_gw00vq$(f);g.hasNext();){var k=
g.next();d(k)?c.append(k):e.append(k)}return new a.kotlin.Pair(c.toString(),e.toString())},plus_bctcxa$:function(b,d){var c=a.kotlin.toArrayList_2hx8bi$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_w5fksc$:function(b,d){var c=a.kotlin.toArrayList_l1lu5s$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_qsh4fe$:function(b,d){var c=a.kotlin.toArrayList_964n92$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_uy8ycc$:function(b,d){var c=a.kotlin.toArrayList_355nu0$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},
plus_kvfz4v$:function(b,d){var c=a.kotlin.toArrayList_bvy38t$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_tev20g$:function(b,d){var c=a.kotlin.toArrayList_rjqrz0$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_wgl9xf$:function(b,d){var c=a.kotlin.toArrayList_tmsbgp$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_v0fo6u$:function(b,d){var c=a.kotlin.toArrayList_se6h4y$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_wshjbk$:function(b,d){var c=a.kotlin.toArrayList_i2lc78$(b);a.kotlin.addAll_jl7u2r$(c,
d);return c},plus_fnn263$:function(b,d){var c=a.kotlin.toArrayList_h3panj$(b);a.kotlin.addAll_jl7u2r$(c,d);return c},plus_qxrbi5$:function(b,d){var c=a.kotlin.toArrayList_2hx8bi$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_34aosx$:function(b,d){var c=a.kotlin.toArrayList_l1lu5s$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_dto1g5$:function(b,d){var c=a.kotlin.toArrayList_964n92$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_ldb6x3$:function(b,d){var c=a.kotlin.toArrayList_355nu0$(b);a.kotlin.addAll_wtmfso$(c,
d);return c},plus_5ya7ho$:function(b,d){var c=a.kotlin.toArrayList_bvy38t$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_t349z9$:function(b,d){var c=a.kotlin.toArrayList_rjqrz0$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_3cdrzs$:function(b,d){var c=a.kotlin.toArrayList_tmsbgp$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_cc6qan$:function(b,d){var c=a.kotlin.toArrayList_se6h4y$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_w98n8l$:function(b,d){var c=a.kotlin.toArrayList_i2lc78$(b);a.kotlin.addAll_wtmfso$(c,
d);return c},plus_975xw0$:function(b,d){var c=a.kotlin.toArrayList_h3panj$(b);a.kotlin.addAll_wtmfso$(c,d);return c},plus_1lsq3i$:function(b,d){return new a.kotlin.Multistream(a.kotlin.streamOf_mzrxf8$([b,a.kotlin.stream_h3panj$(d)]))},plus_fdw1a9$:function(b,d){var c=a.kotlin.toArrayList_2hx8bi$(b);c.add_za3rmp$(d);return c},plus_bsmqrv$:function(b,d){var c=a.kotlin.toArrayList_l1lu5s$(b);c.add_za3rmp$(d);return c},plus_hgt5d7$:function(b,d){var c=a.kotlin.toArrayList_964n92$(b);c.add_za3rmp$(d);
return c},plus_q79yhh$:function(b,d){var c=a.kotlin.toArrayList_355nu0$(b);c.add_za3rmp$(d);return c},plus_96a6a3$:function(b,d){var c=a.kotlin.toArrayList_bvy38t$(b);c.add_za3rmp$(d);return c},plus_thi4tv$:function(b,d){var c=a.kotlin.toArrayList_rjqrz0$(b);c.add_za3rmp$(d);return c},plus_tb5gmf$:function(b,d){var c=a.kotlin.toArrayList_tmsbgp$(b);c.add_za3rmp$(d);return c},plus_ssilt7$:function(b,d){var c=a.kotlin.toArrayList_se6h4y$(b);c.add_za3rmp$(d);return c},plus_x27eb7$:function(b,d){var c=
a.kotlin.toArrayList_i2lc78$(b);c.add_za3rmp$(d);return c},plus_eq3phq$:function(b,d){var c=a.kotlin.toArrayList_h3panj$(b);c.add_za3rmp$(d);return c},plus_9ipe0w$:function(b,d){return new a.kotlin.Multistream(a.kotlin.streamOf_mzrxf8$([b,a.kotlin.streamOf_mzrxf8$([d])]))},plus_y4w53o$:function(b,d){return new a.kotlin.Multistream(a.kotlin.streamOf_mzrxf8$([b,d]))},zip_bctcxa$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_bctcxa$:function(b,d){return a.kotlin.merge_91t4nf$(b,d,a.kotlin.zip_bctcxa$f)},
zip_w5fksc$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_w5fksc$:function(b,d){return a.kotlin.merge_zb2wxp$(b,d,a.kotlin.zip_w5fksc$f)},zip_qsh4fe$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_qsh4fe$:function(b,d){return a.kotlin.merge_au6o65$(b,d,a.kotlin.zip_qsh4fe$f)},zip_uy8ycc$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_uy8ycc$:function(b,d){return a.kotlin.merge_resd0r$(b,d,a.kotlin.zip_uy8ycc$f)},zip_kvfz4v$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_kvfz4v$:function(b,
d){return a.kotlin.merge_6lndoa$(b,d,a.kotlin.zip_kvfz4v$f)},zip_tev20g$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_tev20g$:function(b,d){return a.kotlin.merge_g5oapj$(b,d,a.kotlin.zip_tev20g$f)},zip_wgl9xf$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_wgl9xf$:function(b,d){return a.kotlin.merge_f32dm2$(b,d,a.kotlin.zip_wgl9xf$f)},zip_v0fo6u$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_v0fo6u$:function(b,d){return a.kotlin.merge_oi38kv$(b,d,a.kotlin.zip_v0fo6u$f)},zip_wshjbk$f:function(b,
d){return a.kotlin.to_l1ob02$(b,d)},zip_wshjbk$:function(b,d){return a.kotlin.merge_pn4jvt$(b,d,a.kotlin.zip_wshjbk$f)},zip_fnn263$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_fnn263$:function(b,d){return a.kotlin.merge_tl80ny$(b,d,a.kotlin.zip_fnn263$f)},zip_ny9o$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_ny9o$:function(b,d){return a.kotlin.merge_29xg59$(b,d,a.kotlin.zip_ny9o$f)},zip_qxrbi5$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_qxrbi5$:function(b,d){return a.kotlin.merge_7bg1pg$(b,
d,a.kotlin.zip_qxrbi5$f)},zip_34aosx$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_34aosx$:function(b,d){return a.kotlin.merge_vzyamu$(b,d,a.kotlin.zip_34aosx$f)},zip_dto1g5$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_dto1g5$:function(b,d){return a.kotlin.merge_r76i9w$(b,d,a.kotlin.zip_dto1g5$f)},zip_ldb6x3$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_ldb6x3$:function(b,d){return a.kotlin.merge_d5bgvi$(b,d,a.kotlin.zip_ldb6x3$f)},zip_5ya7ho$f:function(b,d){return a.kotlin.to_l1ob02$(b,
d)},zip_5ya7ho$:function(b,d){return a.kotlin.merge_d6i5gz$(b,d,a.kotlin.zip_5ya7ho$f)},zip_t349z9$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_t349z9$:function(b,d){return a.kotlin.merge_y6emce$(b,d,a.kotlin.zip_t349z9$f)},zip_3cdrzs$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_3cdrzs$:function(b,d){return a.kotlin.merge_k6l5td$(b,d,a.kotlin.zip_3cdrzs$f)},zip_cc6qan$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_cc6qan$:function(b,d){return a.kotlin.merge_ksuah4$(b,d,a.kotlin.zip_cc6qan$f)},
zip_w98n8l$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_w98n8l$:function(b,d){return a.kotlin.merge_eqb4ua$(b,d,a.kotlin.zip_w98n8l$f)},zip_975xw0$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_975xw0$:function(b,d){return a.kotlin.merge_hqmbqh$(b,d,a.kotlin.zip_975xw0$f)},zip_n9t38v$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_n9t38v$:function(b,d){return a.kotlin.merge_q03f9y$(b,d,a.kotlin.zip_n9t38v$f)},zip_94jgcu$:function(f,d){for(var c=a.kotlin.iterator_gw00vq$(f),e=a.kotlin.iterator_gw00vq$(d),
g=new b.ArrayList;c.hasNext()&&e.hasNext();)g.add_za3rmp$(a.kotlin.to_l1ob02$(c.next(),e.next()));return g},zip_y4w53o$f:function(b,d){return a.kotlin.to_l1ob02$(b,d)},zip_y4w53o$:function(b,d){return new a.kotlin.MergingStream(b,d,a.kotlin.zip_y4w53o$f)},contains_fdw1a9$:function(b,d){return 0<=a.kotlin.indexOf_fdw1a9$(b,d)},contains_bsmqrv$:function(b,d){return 0<=a.kotlin.indexOf_bsmqrv$(b,d)},contains_hgt5d7$:function(b,d){return 0<=a.kotlin.indexOf_hgt5d7$(b,d)},contains_q79yhh$:function(b,d){return 0<=
a.kotlin.indexOf_q79yhh$(b,d)},contains_96a6a3$:function(b,d){return 0<=a.kotlin.indexOf_96a6a3$(b,d)},contains_thi4tv$:function(b,d){return 0<=a.kotlin.indexOf_thi4tv$(b,d)},contains_tb5gmf$:function(b,d){return 0<=a.kotlin.indexOf_tb5gmf$(b,d)},contains_ssilt7$:function(b,d){return 0<=a.kotlin.indexOf_ssilt7$(b,d)},contains_x27eb7$:function(b,d){return 0<=a.kotlin.indexOf_x27eb7$(b,d)},contains_eq3phq$:function(f,d){return b.isType(f,a.kotlin.Collection)?f.contains_za3rmp$(d):0<=a.kotlin.indexOf_eq3phq$(f,
d)},contains_9ipe0w$:function(f,d){return b.isType(f,a.kotlin.Collection)?f.contains_za3rmp$(d):0<=a.kotlin.indexOf_9ipe0w$(f,d)},elementAt_fdw77o$:function(a,b){return a[b]},elementAt_rz0vgy$:function(a,b){return a[b]},elementAt_ucmip8$:function(a,b){return a[b]},elementAt_cwi0e2$:function(a,b){return a[b]},elementAt_3qx2rv$:function(a,b){return a[b]},elementAt_2e964m$:function(a,b){return a[b]},elementAt_tb5gmf$:function(a,b){return a[b]},elementAt_x09c4g$:function(a,b){return a[b]},elementAt_7naycm$:function(a,
b){return a[b]},elementAt_eq3vf5$:function(f,d){if(b.isType(f,a.kotlin.List))return f.get_za3lpa$(d);for(var c=f.iterator(),e=0;c.hasNext();){var g=c.next();if(d===e++)return g}throw new RangeError("Collection doesn't contain element at index");},elementAt_ureun9$:function(a,b){return a.get_za3lpa$(b)},elementAt_9ip83h$:function(a,b){for(var c=a.iterator(),e=0;c.hasNext();){var g=c.next();if(b===e++)return g}throw new RangeError("Collection doesn't contain element at index");},elementAt_n7iutu$:function(a,
b){return a.charAt(b)},first_2hx8bi$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_l1lu5s$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_964n92$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_355nu0$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_bvy38t$:function(a){if(0===
a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_rjqrz0$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_tmsbgp$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_se6h4y$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[0]},first_i2lc78$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");
return a[0]},first_h3panj$:function(f){if(b.isType(f,a.kotlin.List)){if(0===a.kotlin.get_size_1(f))throw new b.NoSuchElementException("Collection is empty");return f.get_za3lpa$(0)}f=f.iterator();if(!f.hasNext())throw new b.NoSuchElementException("Collection is empty");return f.next()},first_mtvwn1$:function(f){if(0===a.kotlin.get_size_1(f))throw new b.NoSuchElementException("Collection is empty");return f.get_za3lpa$(0)},first_pdnvbz$:function(f){if(b.isType(f,a.kotlin.List)){if(0===a.kotlin.get_size_1(f))throw new b.NoSuchElementException("Collection is empty");
return f.get_za3lpa$(0)}f=f.iterator();if(!f.hasNext())throw new b.NoSuchElementException("Collection is empty");return f.next()},first_pdl1w0$:function(f){if(0===a.kotlin.get_size_0(f))throw new b.NoSuchElementException("Collection is empty");return f.charAt(0)},first_de9h66$:function(a,d){var c,e;c=a.length;for(e=0;e!==c;++e){var g=a[e];if(d(g))return g}throw new b.NoSuchElementException("No element matching predicate was found");},first_50zxbw$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=
c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_x245au$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_h5ed0c$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_24jijj$:function(a,d){for(var c=
b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_im8pe8$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_1xntkt$:function(a,d){var c,e;c=a.length;for(e=0;e!==c;++e){var g=a[e];if(d(g))return g}throw new b.NoSuchElementException("No element matching predicate was found");},
first_3cuuyy$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_p67zio$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_vqr6wr$:function(a,d){for(var c=a.iterator();c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");
},first_9fpnal$:function(a,d){for(var c=a.iterator();c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},first_t73kuc$:function(f,d){for(var c=a.kotlin.iterator_gw00vq$(f);c.hasNext();){var e=c.next();if(d(e))return e}throw new b.NoSuchElementException("No element matching predicate was found");},firstOrNull_2hx8bi$:function(a){return 0<a.length?a[0]:null},firstOrNull_l1lu5s$:function(a){return 0<a.length?a[0]:null},firstOrNull_964n92$:function(a){return 0<
a.length?a[0]:null},firstOrNull_355nu0$:function(a){return 0<a.length?a[0]:null},firstOrNull_bvy38t$:function(a){return 0<a.length?a[0]:null},firstOrNull_rjqrz0$:function(a){return 0<a.length?a[0]:null},firstOrNull_tmsbgp$:function(a){return 0<a.length?a[0]:null},firstOrNull_se6h4y$:function(a){return 0<a.length?a[0]:null},firstOrNull_i2lc78$:function(a){return 0<a.length?a[0]:null},firstOrNull_h3panj$:function(f){if(b.isType(f,a.kotlin.List))return 0===a.kotlin.get_size_1(f)?null:f.get_za3lpa$(0);
f=f.iterator();return f.hasNext()?f.next():null},firstOrNull_mtvwn1$:function(b){return 0<a.kotlin.get_size_1(b)?b.get_za3lpa$(0):null},firstOrNull_pdnvbz$:function(f){if(b.isType(f,a.kotlin.List))return 0===a.kotlin.get_size_1(f)?null:f.get_za3lpa$(0);f=f.iterator();return f.hasNext()?f.next():null},firstOrNull_pdl1w0$:function(b){return 0<a.kotlin.get_size_0(b)?b.charAt(0):null},firstOrNull_de9h66$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e){var g=a[e];if(b(g))return g}return null},firstOrNull_50zxbw$:function(a,
d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}return null},firstOrNull_x245au$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}return null},firstOrNull_h5ed0c$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}return null},firstOrNull_24jijj$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}return null},firstOrNull_im8pe8$:function(a,d){for(var c=
b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}return null},firstOrNull_1xntkt$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e){var g=a[e];if(b(g))return g}return null},firstOrNull_3cuuyy$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}return null},firstOrNull_p67zio$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return e}return null},firstOrNull_vqr6wr$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=
c.next();if(b(e))return e}return null},firstOrNull_9fpnal$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();if(b(e))return e}return null},firstOrNull_t73kuc$:function(b,d){for(var c=a.kotlin.iterator_gw00vq$(b);c.hasNext();){var e=c.next();if(d(e))return e}return null},indexOf_fdw1a9$:function(a,d){if(null==d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(null==a[e])return e}else for(c=b.arrayIndices(a),e=c.start,g=c.end,c=c.increment;e<=g;e+=c)if(b.equals(d,
a[e]))return e;return-1},indexOf_bsmqrv$:function(a,d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(b.equals(d,a[e]))return e;return-1},indexOf_hgt5d7$:function(a,d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(d===a[e])return e;return-1},indexOf_q79yhh$:function(a,d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(d===a[e])return e;return-1},indexOf_96a6a3$:function(a,d){var c,e,g;c=b.arrayIndices(a);
e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(d===a[e])return e;return-1},indexOf_thi4tv$:function(a,d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(d===a[e])return e;return-1},indexOf_tb5gmf$:function(a,d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(d===a[e])return e;return-1},indexOf_ssilt7$:function(a,d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(d===a[e])return e;return-1},indexOf_x27eb7$:function(a,
d){var c,e,g;c=b.arrayIndices(a);e=c.start;g=c.end;for(c=c.increment;e<=g;e+=c)if(d===a[e])return e;return-1},indexOf_eq3phq$:function(a,d){for(var c=0,e=a.iterator();e.hasNext();){var g=e.next();if(b.equals(d,g))return c;c++}return-1},indexOf_9ipe0w$:function(a,d){for(var c=0,e=a.iterator();e.hasNext();){var g=e.next();if(b.equals(d,g))return c;c++}return-1},last_2hx8bi$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_l1lu5s$:function(a){if(0===
a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_964n92$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_355nu0$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_bvy38t$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_rjqrz0$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");
return a[a.length-1]},last_tmsbgp$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_se6h4y$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_i2lc78$:function(a){if(0===a.length)throw new b.NoSuchElementException("Collection is empty");return a[a.length-1]},last_h3panj$:function(f){if(b.isType(f,a.kotlin.List)){if(0===a.kotlin.get_size_1(f))throw new b.NoSuchElementException("Collection is empty");
return f.get_za3lpa$(a.kotlin.get_size_1(f)-1)}f=f.iterator();if(!f.hasNext())throw new b.NoSuchElementException("Collection is empty");for(var d=f.next();f.hasNext();)d=f.next();return d},last_mtvwn1$:function(f){if(0===a.kotlin.get_size_1(f))throw new b.NoSuchElementException("Collection is empty");return f.get_za3lpa$(a.kotlin.get_size_1(f)-1)},last_pdnvbz$:function(f){if(b.isType(f,a.kotlin.List)){if(0===a.kotlin.get_size_1(f))throw new b.NoSuchElementException("Collection is empty");return f.get_za3lpa$(a.kotlin.get_size_1(f)-
1)}f=f.iterator();if(!f.hasNext())throw new b.NoSuchElementException("Collection is empty");for(var d=f.next();f.hasNext();)d=f.next();return d},last_pdl1w0$:function(f){if(0===a.kotlin.get_size_0(f))throw new b.NoSuchElementException("Collection is empty");return f.charAt(a.kotlin.get_size_0(f)-1)},last_de9h66$:function(a,d){var c=null,e=!1,g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];d(x)&&(c=x,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");
return c},last_50zxbw$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},last_x245au$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},
last_h5ed0c$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},last_24jijj$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},last_im8pe8$:function(a,
d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},last_1xntkt$:function(a,d){var c=null,e=!1,g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];d(x)&&(c=x,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},last_3cuuyy$:function(a,d){for(var c=null,
e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},last_p67zio$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},last_vqr6wr$:function(a,d){for(var c=null,e=!1,g=
a.iterator();g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return c},last_9fpnal$:function(a,d){for(var c=null,e=!1,g=a.iterator();g.hasNext();){var k=g.next();d(k)&&(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return c},last_t73kuc$:function(f,d){for(var c=null,e=!1,g=a.kotlin.iterator_gw00vq$(f);g.hasNext();){var k=g.next();d(k)&&
(c=k,e=!0)}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},lastIndexOf_fdw1a9$:function(f,d){if(null==d)for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(null==f[e])return e}else for(c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();)if(e=c.next(),b.equals(d,f[e]))return e;return-1},lastIndexOf_bsmqrv$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=
c.next();if(b.equals(d,f[e]))return e}return-1},lastIndexOf_hgt5d7$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(d===f[e])return e}return-1},lastIndexOf_q79yhh$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(d===f[e])return e}return-1},lastIndexOf_96a6a3$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(d===
f[e])return e}return-1},lastIndexOf_thi4tv$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(d===f[e])return e}return-1},lastIndexOf_tb5gmf$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(d===f[e])return e}return-1},lastIndexOf_ssilt7$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(d===f[e])return e}return-1},
lastIndexOf_x27eb7$:function(f,d){for(var c=a.kotlin.reverse_h3panj$(b.arrayIndices(f)).iterator();c.hasNext();){var e=c.next();if(d===f[e])return e}return-1},lastIndexOf_eq3phq$:function(a,d){for(var c=-1,e=0,g=a.iterator();g.hasNext();){var k=g.next();b.equals(d,k)&&(c=e);e++}return c},lastIndexOf_ureopu$:function(f,d){if(null==d)for(var c=a.kotlin.reverse_h3panj$(a.kotlin.get_indices(f)).iterator();c.hasNext();){var e=c.next();if(null==f.get_za3lpa$(e))return e}else for(c=a.kotlin.reverse_h3panj$(a.kotlin.get_indices(f)).iterator();c.hasNext();)if(e=
c.next(),b.equals(d,f.get_za3lpa$(e)))return e;return-1},lastIndexOf_9ipe0w$:function(a,d){for(var c=-1,e=0,g=a.iterator();g.hasNext();){var k=g.next();b.equals(d,k)&&(c=e);e++}return c},lastOrNull_2hx8bi$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_l1lu5s$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_964n92$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_355nu0$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_bvy38t$:function(a){return 0<
a.length?a[a.length-1]:null},lastOrNull_rjqrz0$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_tmsbgp$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_se6h4y$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_i2lc78$:function(a){return 0<a.length?a[a.length-1]:null},lastOrNull_h3panj$:function(f){if(b.isType(f,a.kotlin.List))return 0<a.kotlin.get_size_1(f)?f.get_za3lpa$(a.kotlin.get_size_1(f)-1):null;f=f.iterator();if(!f.hasNext())return null;for(var d=f.next();f.hasNext();)d=
f.next();return d},lastOrNull_mtvwn1$:function(b){return 0<a.kotlin.get_size_1(b)?b.get_za3lpa$(a.kotlin.get_size_1(b)-1):null},lastOrNull_pdnvbz$:function(f){if(b.isType(f,a.kotlin.List))return 0<a.kotlin.get_size_1(f)?f.get_za3lpa$(a.kotlin.get_size_1(f)-1):null;f=f.iterator();if(!f.hasNext())return null;for(var d=f.next();f.hasNext();)d=f.next();return d},lastOrNull_pdl1w0$:function(b){return 0<a.kotlin.get_size_0(b)?b.charAt(a.kotlin.get_size_0(b)-1):null},lastOrNull_de9h66$:function(a,b){var c=
null,e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];b(k)&&(c=k)}return c},lastOrNull_50zxbw$:function(a,d){for(var c=null,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&(c=g)}return c},lastOrNull_x245au$:function(a,d){for(var c=null,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&(c=g)}return c},lastOrNull_h5ed0c$:function(a,d){for(var c=null,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&(c=g)}return c},lastOrNull_24jijj$:function(a,d){for(var c=null,e=b.arrayIterator(a);e.hasNext();){var g=
e.next();d(g)&&(c=g)}return c},lastOrNull_im8pe8$:function(a,d){for(var c=null,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&(c=g)}return c},lastOrNull_1xntkt$:function(a,b){var c=null,e,g;e=a.length;for(g=0;g!==e;++g){var k=a[g];b(k)&&(c=k)}return c},lastOrNull_3cuuyy$:function(a,d){for(var c=null,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&(c=g)}return c},lastOrNull_p67zio$:function(a,d){for(var c=null,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&(c=g)}return c},
lastOrNull_vqr6wr$:function(a,b){for(var c=null,e=a.iterator();e.hasNext();){var g=e.next();b(g)&&(c=g)}return c},lastOrNull_9fpnal$:function(a,b){for(var c=null,e=a.iterator();e.hasNext();){var g=e.next();b(g)&&(c=g)}return c},lastOrNull_t73kuc$:function(b,d){for(var c=null,e=a.kotlin.iterator_gw00vq$(b);e.hasNext();){var g=e.next();d(g)&&(c=g)}return c},single_2hx8bi$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");
return a},single_l1lu5s$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},single_964n92$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},single_355nu0$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");
if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},single_bvy38t$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},single_rjqrz0$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");
return a},single_tmsbgp$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},single_se6h4y$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},single_i2lc78$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");
if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},single_h3panj$:function(f){var d=a.kotlin.get_size_1(f);if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)d=f.get_za3lpa$(0);else throw new b.IllegalArgumentException("Collection has more than one element");if(b.isType(f,a.kotlin.List))return d;f=f.iterator();if(!f.hasNext())throw new b.NoSuchElementException("Collection is empty");d=f.next();if(f.hasNext())throw new b.IllegalArgumentException("Collection has more than one element");
return d},single_mtvwn1$:function(f){var d=a.kotlin.get_size_1(f);if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)f=f.get_za3lpa$(0);else throw new b.IllegalArgumentException("Collection has more than one element");return f},single_pdnvbz$:function(f){var d=a.kotlin.get_size_1(f);if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)d=f.get_za3lpa$(0);else throw new b.IllegalArgumentException("Collection has more than one element");if(b.isType(f,a.kotlin.List))return d;
f=f.iterator();if(!f.hasNext())throw new b.NoSuchElementException("Collection is empty");d=f.next();if(f.hasNext())throw new b.IllegalArgumentException("Collection has more than one element");return d},single_pdl1w0$:function(f){var d=a.kotlin.get_size_0(f);if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)f=f.charAt(0);else throw new b.IllegalArgumentException("Collection has more than one element");return f},single_de9h66$:function(a,d){var c=null,e=!1,g,k;g=a.length;for(k=
0;k!==g;++k){var x=a[k];if(d(x)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=x;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return c},single_50zxbw$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");
return null!=c?c:b.throwNPE()},single_x245au$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},single_h5ed0c$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");
c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},single_24jijj$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},single_im8pe8$:function(a,
d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},single_1xntkt$:function(a,d){var c=null,e=!1,g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];if(d(x)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");
c=x;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},single_3cuuyy$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},single_p67zio$:function(a,
d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},single_vqr6wr$:function(a,d){for(var c=null,e=!1,g=a.iterator();g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");
c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return c},single_9fpnal$:function(a,d){for(var c=null,e=!1,g=a.iterator();g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return c},single_t73kuc$:function(f,d){for(var c=null,e=!1,g=a.kotlin.iterator_gw00vq$(f);g.hasNext();){var k=
g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}if(!e)throw new b.NoSuchElementException("Collection doesn't contain any element matching predicate");return null!=c?c:b.throwNPE()},singleOrNull_2hx8bi$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_l1lu5s$:function(a){var d=
a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_964n92$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_355nu0$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");
if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_bvy38t$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_rjqrz0$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");
return a},singleOrNull_tmsbgp$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_se6h4y$:function(a){var d=a.length;if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_i2lc78$:function(a){var d=a.length;
if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)a=a[0];else throw new b.IllegalArgumentException("Collection has more than one element");return a},singleOrNull_h3panj$:function(f){var d=a.kotlin.get_size_1(f);if(0===d)d=null;else if(1===d)d=f.get_za3lpa$(0);else throw new b.IllegalArgumentException("Collection has more than one element");if(b.isType(f,a.kotlin.List))return d;f=f.iterator();if(!f.hasNext())return null;d=f.next();if(f.hasNext())throw new b.IllegalArgumentException("Collection has more than one element");
return d},singleOrNull_mtvwn1$:function(f){var d=a.kotlin.get_size_1(f);if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)f=f.get_za3lpa$(0);else throw new b.IllegalArgumentException("Collection has more than one element");return f},singleOrNull_pdnvbz$:function(f){var d=a.kotlin.get_size_1(f);if(0===d)d=null;else if(1===d)d=f.get_za3lpa$(0);else throw new b.IllegalArgumentException("Collection has more than one element");if(b.isType(f,a.kotlin.List))return d;f=f.iterator();
if(!f.hasNext())return null;d=f.next();if(f.hasNext())throw new b.IllegalArgumentException("Collection has more than one element");return d},singleOrNull_pdl1w0$:function(f){var d=a.kotlin.get_size_0(f);if(0===d)throw new b.NoSuchElementException("Collection is empty");if(1===d)f=f.charAt(0);else throw new b.IllegalArgumentException("Collection has more than one element");return f},singleOrNull_de9h66$:function(a,d){var c=null,e=!1,g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];if(d(x)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");
c=x;e=!0}}return e?c:null},singleOrNull_50zxbw$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},singleOrNull_x245au$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},
singleOrNull_h5ed0c$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},singleOrNull_24jijj$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},singleOrNull_im8pe8$:function(a,
d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},singleOrNull_1xntkt$:function(a,d){var c=null,e=!1,g,k;g=a.length;for(k=0;k!==g;++k){var x=a[k];if(d(x)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=x;e=!0}}return e?c:null},singleOrNull_3cuuyy$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=
g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},singleOrNull_p67zio$:function(a,d){for(var c=null,e=!1,g=b.arrayIterator(a);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},singleOrNull_vqr6wr$:function(a,d){for(var c=null,e=!1,g=a.iterator();g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");
c=k;e=!0}}return e?c:null},singleOrNull_9fpnal$:function(a,d){for(var c=null,e=!1,g=a.iterator();g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},singleOrNull_t73kuc$:function(f,d){for(var c=null,e=!1,g=a.kotlin.iterator_gw00vq$(f);g.hasNext();){var k=g.next();if(d(k)){if(e)throw new b.IllegalArgumentException("Collection contains more than one matching element");c=k;e=!0}}return e?c:null},
times_97ovpz$:function(a,b){for(var c=a;0<c;)b(),c--},require_eltq40$:function(a,d){void 0===d&&(d="Failed requirement");if(!a)throw new b.IllegalArgumentException(d.toString());},require_zgzqbg$:function(a,d){if(!a){var c=d();throw new b.IllegalArgumentException(c.toString());}},requireNotNull_wn2jw4$:function(a,d){void 0===d&&(d="Required value was null");if(null==a)throw new b.IllegalArgumentException(d.toString());return a},check_eltq40$:function(a,d){void 0===d&&(d="Check failed");if(!a)throw new b.IllegalStateException(d.toString());
},check_zgzqbg$:function(a,d){if(!a){var c=d();throw new b.IllegalStateException(c.toString());}},checkNotNull_hwpqgh$:function(a,d){void 0===d&&(d="Required value was null");if(null==a)throw new b.IllegalStateException(d);return a},error_61zpoe$:function(a){throw new b.RuntimeException(a);},toArrayList_2hx8bi$:function(a){var d=new b.ArrayList(a.length),c,e;c=a.length;for(e=0;e!==c;++e)d.add_za3rmp$(a[e]);return d},toArrayList_l1lu5s$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=
a.next();d.add_za3rmp$(c)}return d},toArrayList_964n92$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toArrayList_355nu0$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toArrayList_bvy38t$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toArrayList_rjqrz0$:function(a){var d=
new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toArrayList_tmsbgp$:function(a){var d=new b.ArrayList(a.length),c,e;c=a.length;for(e=0;e!==c;++e)d.add_za3rmp$(a[e]);return d},toArrayList_se6h4y$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toArrayList_i2lc78$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},
toArrayList_h3panj$:function(f){return a.kotlin.toCollection_4jj70a$(f,new b.ArrayList)},toArrayList_pdnvbz$:function(f){return a.kotlin.toCollection_791eew$(f,new b.ArrayList)},toArrayList_pdl1w0$:function(f){return a.kotlin.toCollection_j1020p$(f,new b.ArrayList)},toCollection_xpmo5j$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)b.add_za3rmp$(a[e]);return b},toCollection_aaeveh$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toCollection_d1lgh$:function(a,
d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toCollection_ba3pld$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toCollection_enu0mi$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toCollection_gk003p$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toCollection_mglpxq$:function(a,b){var c,e;c=a.length;
for(e=0;e!==c;++e)b.add_za3rmp$(a[e]);return b},toCollection_vus1ud$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toCollection_5k8uqj$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toCollection_4jj70a$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();b.add_za3rmp$(e)}return b},toCollection_791eew$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();b.add_za3rmp$(e)}return b},
toCollection_j1020p$:function(b,d){for(var c=a.kotlin.iterator_gw00vq$(b);c.hasNext();){var e=c.next();d.add_za3rmp$(e)}return d},toHashSet_2hx8bi$:function(f){return a.kotlin.toCollection_xpmo5j$(f,new b.ComplexHashSet)},toHashSet_l1lu5s$:function(f){return a.kotlin.toCollection_aaeveh$(f,new b.PrimitiveHashSet)},toHashSet_964n92$:function(f){return a.kotlin.toCollection_d1lgh$(f,new b.PrimitiveHashSet)},toHashSet_355nu0$:function(f){return a.kotlin.toCollection_ba3pld$(f,new b.PrimitiveHashSet)},
toHashSet_bvy38t$:function(f){return a.kotlin.toCollection_enu0mi$(f,new b.PrimitiveHashSet)},toHashSet_rjqrz0$:function(f){return a.kotlin.toCollection_gk003p$(f,new b.PrimitiveHashSet)},toHashSet_tmsbgp$:function(f){return a.kotlin.toCollection_mglpxq$(f,new b.PrimitiveHashSet)},toHashSet_se6h4y$:function(f){return a.kotlin.toCollection_vus1ud$(f,new b.PrimitiveHashSet)},toHashSet_i2lc78$:function(f){return a.kotlin.toCollection_5k8uqj$(f,new b.PrimitiveHashSet)},toHashSet_h3panj$:function(f){return a.kotlin.toCollection_4jj70a$(f,
new b.ComplexHashSet)},toHashSet_pdnvbz$:function(f){return a.kotlin.toCollection_791eew$(f,new b.ComplexHashSet)},toHashSet_pdl1w0$:function(f){return a.kotlin.toCollection_j1020p$(f,new b.PrimitiveHashSet)},toLinkedList_2hx8bi$:function(f){return a.kotlin.toCollection_xpmo5j$(f,new b.LinkedList)},toLinkedList_l1lu5s$:function(f){return a.kotlin.toCollection_aaeveh$(f,new b.LinkedList)},toLinkedList_964n92$:function(f){return a.kotlin.toCollection_d1lgh$(f,new b.LinkedList)},toLinkedList_355nu0$:function(f){return a.kotlin.toCollection_ba3pld$(f,
new b.LinkedList)},toLinkedList_bvy38t$:function(f){return a.kotlin.toCollection_enu0mi$(f,new b.LinkedList)},toLinkedList_rjqrz0$:function(f){return a.kotlin.toCollection_gk003p$(f,new b.LinkedList)},toLinkedList_tmsbgp$:function(f){return a.kotlin.toCollection_mglpxq$(f,new b.LinkedList)},toLinkedList_se6h4y$:function(f){return a.kotlin.toCollection_vus1ud$(f,new b.LinkedList)},toLinkedList_i2lc78$:function(f){return a.kotlin.toCollection_5k8uqj$(f,new b.LinkedList)},toLinkedList_h3panj$:function(f){return a.kotlin.toCollection_4jj70a$(f,
new b.LinkedList)},toLinkedList_pdnvbz$:function(f){return a.kotlin.toCollection_791eew$(f,new b.LinkedList)},toLinkedList_pdl1w0$:function(f){return a.kotlin.toCollection_j1020p$(f,new b.LinkedList)},toList_s8ckw1$:function(f){var d=new b.ArrayList(a.kotlin.get_size(f));for(f=a.kotlin.iterator_s8ckw1$(f);f.hasNext();){var c=f.next();d.add_za3rmp$(c)}return d},toList_2hx8bi$:function(f){return a.kotlin.toCollection_xpmo5j$(f,new b.ArrayList)},toList_l1lu5s$:function(a){var d=new b.ArrayList(a.length);
for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toList_964n92$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toList_355nu0$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toList_bvy38t$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},
toList_rjqrz0$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toList_tmsbgp$:function(a){var d=new b.ArrayList(a.length),c,e;c=a.length;for(e=0;e!==c;++e)d.add_za3rmp$(a[e]);return d},toList_se6h4y$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=a.next();d.add_za3rmp$(c)}return d},toList_i2lc78$:function(a){var d=new b.ArrayList(a.length);for(a=b.arrayIterator(a);a.hasNext();){var c=
a.next();d.add_za3rmp$(c)}return d},toList_h3panj$:function(f){return a.kotlin.toCollection_4jj70a$(f,new b.ArrayList)},toList_pdnvbz$:function(f){return a.kotlin.toCollection_791eew$(f,new b.ArrayList)},toList_pdl1w0$:function(f){return a.kotlin.toCollection_j1020p$(f,new b.ArrayList)},toSet_2hx8bi$:function(f){return a.kotlin.toCollection_xpmo5j$(f,new b.LinkedHashSet)},toSet_l1lu5s$:function(f){return a.kotlin.toCollection_aaeveh$(f,new b.LinkedHashSet)},toSet_964n92$:function(f){return a.kotlin.toCollection_d1lgh$(f,
new b.LinkedHashSet)},toSet_355nu0$:function(f){return a.kotlin.toCollection_ba3pld$(f,new b.LinkedHashSet)},toSet_bvy38t$:function(f){return a.kotlin.toCollection_enu0mi$(f,new b.LinkedHashSet)},toSet_rjqrz0$:function(f){return a.kotlin.toCollection_gk003p$(f,new b.LinkedHashSet)},toSet_tmsbgp$:function(f){return a.kotlin.toCollection_mglpxq$(f,new b.LinkedHashSet)},toSet_se6h4y$:function(f){return a.kotlin.toCollection_vus1ud$(f,new b.LinkedHashSet)},toSet_i2lc78$:function(f){return a.kotlin.toCollection_5k8uqj$(f,
new b.LinkedHashSet)},toSet_h3panj$:function(f){return a.kotlin.toCollection_4jj70a$(f,new b.LinkedHashSet)},toSet_pdnvbz$:function(f){return a.kotlin.toCollection_791eew$(f,new b.LinkedHashSet)},toSet_pdl1w0$:function(f){return a.kotlin.toCollection_j1020p$(f,new b.LinkedHashSet)},toSortedSet_2hx8bi$:function(f){return a.kotlin.toCollection_xpmo5j$(f,new b.TreeSet)},toSortedSet_l1lu5s$:function(f){return a.kotlin.toCollection_aaeveh$(f,new b.TreeSet)},toSortedSet_964n92$:function(f){return a.kotlin.toCollection_d1lgh$(f,
new b.TreeSet)},toSortedSet_355nu0$:function(f){return a.kotlin.toCollection_ba3pld$(f,new b.TreeSet)},toSortedSet_bvy38t$:function(f){return a.kotlin.toCollection_enu0mi$(f,new b.TreeSet)},toSortedSet_rjqrz0$:function(f){return a.kotlin.toCollection_gk003p$(f,new b.TreeSet)},toSortedSet_tmsbgp$:function(f){return a.kotlin.toCollection_mglpxq$(f,new b.TreeSet)},toSortedSet_se6h4y$:function(f){return a.kotlin.toCollection_vus1ud$(f,new b.TreeSet)},toSortedSet_i2lc78$:function(f){return a.kotlin.toCollection_5k8uqj$(f,
new b.TreeSet)},toSortedSet_h3panj$:function(f){return a.kotlin.toCollection_4jj70a$(f,new b.TreeSet)},toSortedSet_pdnvbz$:function(f){return a.kotlin.toCollection_791eew$(f,new b.TreeSet)},toSortedSet_pdl1w0$:function(f){return a.kotlin.toCollection_j1020p$(f,new b.TreeSet)},appendString_vt6b28$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_vt6b28$(b,d,c,e,g,k,x)},appendString_v2fgr2$:function(b,d,c,e,g,
k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_v2fgr2$(b,d,c,e,g,k,x)},appendString_ds6lso$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_ds6lso$(b,d,c,e,g,k,x)},appendString_2b34ga$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_2b34ga$(b,
d,c,e,g,k,x)},appendString_kjxfqn$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_kjxfqn$(b,d,c,e,g,k,x)},appendString_bt92bi$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_bt92bi$(b,d,c,e,g,k,x)},appendString_xc3j4b$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=
-1);void 0===x&&(x="...");a.kotlin.joinTo_xc3j4b$(b,d,c,e,g,k,x)},appendString_2bqqsc$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_2bqqsc$(b,d,c,e,g,k,x)},appendString_ex638e$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_ex638e$(b,d,c,e,g,k,x)},appendString_4ybsr7$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");
void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_4ybsr7$(b,d,c,e,g,k,x)},appendString_tsa3bz$:function(b,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");a.kotlin.joinTo_tsa3bz$(b,d,c,e,g,k,x)},joinTo_vt6b28$:function(a,b,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");b.append(e);e=0;var z,A;z=a.length;for(A=0;A!==z;++A){var C=
a[A];1<++e&&b.append(c);if(0>k||e<=k)b.append(null==C?"null":C.toString());else break}0<=k&&e>k&&b.append(x);b.append(g);return b},joinTo_v2fgr2$:function(a,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");d.append(e);e=0;for(a=b.arrayIterator(a);a.hasNext();){var z=a.next();1<++e&&d.append(c);if(0>k||e<=k)d.append(z.toString());else break}0<=k&&e>k&&d.append(x);d.append(g);return d},joinTo_ds6lso$:function(a,d,c,e,g,k,x){void 0===c&&
(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");d.append(e);e=0;for(a=b.arrayIterator(a);a.hasNext();){var z=a.next();1<++e&&d.append(c);if(0>k||e<=k)d.append(z.toString());else break}0<=k&&e>k&&d.append(x);d.append(g);return d},joinTo_2b34ga$:function(a,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");d.append(e);e=0;for(a=b.arrayIterator(a);a.hasNext();){var z=a.next();1<++e&&d.append(c);if(0>
k||e<=k)d.append(z.toString());else break}0<=k&&e>k&&d.append(x);d.append(g);return d},joinTo_kjxfqn$:function(a,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");d.append(e);e=0;for(a=b.arrayIterator(a);a.hasNext();){var z=a.next();1<++e&&d.append(c);if(0>k||e<=k)d.append(z.toString());else break}0<=k&&e>k&&d.append(x);d.append(g);return d},joinTo_bt92bi$:function(a,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g=
"");void 0===k&&(k=-1);void 0===x&&(x="...");d.append(e);e=0;for(a=b.arrayIterator(a);a.hasNext();){var z=a.next();1<++e&&d.append(c);if(0>k||e<=k)d.append(z.toString());else break}0<=k&&e>k&&d.append(x);d.append(g);return d},joinTo_xc3j4b$:function(a,b,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");b.append(e);e=0;var z,A;z=a.length;for(A=0;A!==z;++A){var C=a[A];1<++e&&b.append(c);if(0>k||e<=k)b.append(C.toString());else break}0<=k&&
e>k&&b.append(x);b.append(g);return b},joinTo_2bqqsc$:function(a,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");d.append(e);e=0;for(a=b.arrayIterator(a);a.hasNext();){var z=a.next();1<++e&&d.append(c);if(0>k||e<=k)d.append(z.toString());else break}0<=k&&e>k&&d.append(x);d.append(g);return d},joinTo_ex638e$:function(a,d,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");d.append(e);
e=0;for(a=b.arrayIterator(a);a.hasNext();){var z=a.next();1<++e&&d.append(c);if(0>k||e<=k)d.append(z.toString());else break}0<=k&&e>k&&d.append(x);d.append(g);return d},joinTo_4ybsr7$:function(a,b,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");b.append(e);e=0;for(a=a.iterator();a.hasNext();){var z=a.next();1<++e&&b.append(c);if(0>k||e<=k)b.append(null==z?"null":z.toString());else break}0<=k&&e>k&&b.append(x);b.append(g);return b},joinTo_tsa3bz$:function(a,
b,c,e,g,k,x){void 0===c&&(c=", ");void 0===e&&(e="");void 0===g&&(g="");void 0===k&&(k=-1);void 0===x&&(x="...");b.append(e);e=0;for(a=a.iterator();a.hasNext();){var z=a.next();1<++e&&b.append(c);if(0>k||e<=k)b.append(null==z?"null":z.toString());else break}0<=k&&e>k&&b.append(x);b.append(g);return b},joinToString_7s66u8$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_vt6b28$(f,new b.StringBuilder,d,
c,e,g,k).toString()},joinToString_cmivou$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_v2fgr2$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_7gqm6g$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_ds6lso$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_5g9kba$:function(f,d,c,e,g,k){void 0===
d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_2b34ga$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_fwx41b$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_kjxfqn$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_sfhf6m$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=
-1);void 0===k&&(k="...");return a.kotlin.joinTo_bt92bi$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_6b4cej$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_xc3j4b$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_s6c98k$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_2bqqsc$(f,new b.StringBuilder,
d,c,e,g,k).toString()},joinToString_pukide$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_ex638e$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_mc2pv1$:function(f,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_4ybsr7$(f,new b.StringBuilder,d,c,e,g,k).toString()},joinToString_tpghi9$:function(f,d,c,e,g,
k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinTo_tsa3bz$(f,new b.StringBuilder,d,c,e,g,k).toString()},makeString_7s66u8$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_7s66u8$(b,d,c,e,g,k)},makeString_cmivou$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&
(k="...");return a.kotlin.joinToString_cmivou$(b,d,c,e,g,k)},makeString_7gqm6g$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_7gqm6g$(b,d,c,e,g,k)},makeString_5g9kba$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_5g9kba$(b,d,c,e,g,k)},makeString_fwx41b$:function(b,d,c,e,g,k){void 0===d&&(d=
", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_fwx41b$(b,d,c,e,g,k)},makeString_sfhf6m$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_sfhf6m$(b,d,c,e,g,k)},makeString_6b4cej$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_6b4cej$(b,
d,c,e,g,k)},makeString_s6c98k$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_s6c98k$(b,d,c,e,g,k)},makeString_pukide$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_pukide$(b,d,c,e,g,k)},makeString_mc2pv1$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===
g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_mc2pv1$(b,d,c,e,g,k)},makeString_tpghi9$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_tpghi9$(b,d,c,e,g,k)},trim_94jgcu$:function(b,d){return a.kotlin.trimTrailing_94jgcu$(a.kotlin.trimLeading_94jgcu$(b,d),d)},trim_ex0kps$:function(b,d,c){return a.kotlin.trimTrailing_94jgcu$(a.kotlin.trimLeading_94jgcu$(b,d),c)},trimLeading_94jgcu$:function(a,
b){var c=a;c.startsWith(b)&&(c=c.substring(b.length));return c},trimTrailing_94jgcu$:function(a,b){var c=a;c.endsWith(b)&&(c=c.substring(0,a.length-b.length));return c},isNotEmpty_pdl1w0$:function(a){return null!=a&&0<a.length},iterator_gw00vq$:function(f){return b.createObject(function(){return[a.kotlin.CharIterator]},function c(){c.baseInitializer.call(this);this.index_xuly00$=0},{nextChar:function(){return f.get_za3lpa$(this.index_xuly00$++)},hasNext:function(){return this.index_xuly00$<f.length}})},
orEmpty_pdl1w0$:function(a){return null!=a?a:""},get_size_2:{value:function(a){return a.length}},get_size_0:{value:function(a){return a.length}},get_indices_1:{value:function(a){return new b.NumberRange(0,a.length-1)}},slice_bchp91$:function(a,d){for(var c=new b.StringBuilder,e=d.iterator();e.hasNext();){var g=e.next();c.append(a.get_za3lpa$(g))}return c.toString()},substring_cumll7$:function(a,b){return a.substring(b.start,b.end+1)},join_mc2pv1$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===
c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_mc2pv1$(b,d,c,e,g,k)},join_7s66u8$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_7s66u8$(b,d,c,e,g,k)},join_tpghi9$:function(b,d,c,e,g,k){void 0===d&&(d=", ");void 0===c&&(c="");void 0===e&&(e="");void 0===g&&(g=-1);void 0===k&&(k="...");return a.kotlin.joinToString_tpghi9$(b,d,c,e,g,k)},substringBefore_960177$:function(b,
d){var c=a.js.indexOf_960177$(b,d);return-1===c?b:b.substring(0,c)},substringBefore_94jgcu$:function(a,b){var c=a.indexOf(b);return-1===c?a:a.substring(0,c)},substringAfter_960177$:function(b,d){var c=a.js.indexOf_960177$(b,d);return-1===c?"":b.substring(c+1,b.length)},substringAfter_94jgcu$:function(a,b){var c=a.indexOf(b);return-1===c?"":a.substring(c+b.length,a.length)},substringBeforeLast_960177$:function(b,d){var c=a.js.lastIndexOf_960177$(b,d);return-1===c?b:b.substring(0,c)},substringBeforeLast_94jgcu$:function(a,
b){var c=a.lastIndexOf(b);return-1===c?a:a.substring(0,c)},substringAfterLast_960177$:function(b,d){var c=a.js.lastIndexOf_960177$(b,d);return-1===c?"":b.substring(c+1,b.length)},substringAfterLast_94jgcu$:function(a,b){var c=a.lastIndexOf(b);return-1===c?"":a.substring(c+b.length,a.length)},replaceRange_d9884y$:function(a,d,c,e){if(c<d)throw new RangeError("Last index ("+c+") is less than first index ("+d+")");var g=new b.StringBuilder;g.append(a,0,d);g.append(e);g.append(a,c,a.length);return g.toString()},
replaceRange_rxpzkz$:function(a,d,c){if(d.end<d.start)throw new RangeError("Last index ("+d.start+") is less than first index ("+d.end+")");var e=new b.StringBuilder;e.append(a,0,d.start);e.append(c);e.append(a,d.end,a.length);return e.toString()},replaceBefore_7uhrl1$:function(b,d,c){d=a.js.indexOf_960177$(b,d);return-1===d?c:a.kotlin.replaceRange_d9884y$(b,0,d,c)},replaceBefore_ex0kps$:function(b,d,c){d=b.indexOf(d);return-1===d?c:a.kotlin.replaceRange_d9884y$(b,0,d,c)},replaceAfter_7uhrl1$:function(b,
d,c){d=a.js.indexOf_960177$(b,d);return-1===d?b:a.kotlin.replaceRange_d9884y$(b,d+1,b.length,c)},replaceAfter_ex0kps$:function(b,d,c){var e=b.indexOf(d);return-1===e?b:a.kotlin.replaceRange_d9884y$(b,e+d.length,b.length,c)},replaceAfterLast_ex0kps$:function(b,d,c){var e=b.lastIndexOf(d);return-1===e?b:a.kotlin.replaceRange_d9884y$(b,e+d.length,b.length,c)},replaceAfterLast_7uhrl1$:function(b,d,c){d=a.js.lastIndexOf_960177$(b,d);return-1===d?b:a.kotlin.replaceRange_d9884y$(b,d+1,b.length,c)},replaceBeforeLast_7uhrl1$:function(b,
d,c){d=a.js.lastIndexOf_960177$(b,d);return-1===d?c:a.kotlin.replaceRange_d9884y$(b,0,d,c)},replaceBeforeLast_ex0kps$:function(b,d,c){d=b.lastIndexOf(d);return-1===d?c:a.kotlin.replaceRange_d9884y$(b,0,d,c)},StringBuilder_lxq41y$:function(a){var d=new b.StringBuilder;a.call(d);return d},append_d4iu1a$:function(a,b){var c,e;c=b.length;for(e=0;e!==c;++e)a.append(b[e]);return a},append_ya45mk$:function(a,b){var c,e;c=b.length;for(e=0;e!==c;++e)a.append(b[e]);return a},append_ya45mk$_0:function(a,b){var c,
e;c=b.length;for(e=0;e!==c;++e)a.append(b[e]);return a},sum_h3panj$:function(a){a=a.iterator();for(var b=0;a.hasNext();)b+=a.next();return b},sum_h3panj$_0:function(a){a=a.iterator();for(var b=0;a.hasNext();)b+=a.next();return b},sum_h3panj$_1:function(a){a=a.iterator();for(var b=0;a.hasNext();)b+=a.next();return b},sum_h3panj$_2:function(a){a=a.iterator();for(var b=0;a.hasNext();)b+=a.next();return b},sum_2hx8bi$:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_tmsbgp$:function(a){a=
b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_2hx8bi$_0:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_se6h4y$:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_2hx8bi$_1:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_964n92$:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_2hx8bi$_2:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=
a.next();return d},sum_i2lc78$:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_2hx8bi$_3:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_bvy38t$:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_2hx8bi$_4:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},sum_rjqrz0$:function(a){a=b.arrayIterator(a);for(var d=0;a.hasNext();)d+=a.next();return d},reverse_2hx8bi$:function(f){f=
a.kotlin.toArrayList_2hx8bi$(f);b.reverse(f);return f},reverse_l1lu5s$:function(f){f=a.kotlin.toArrayList_l1lu5s$(f);b.reverse(f);return f},reverse_964n92$:function(f){f=a.kotlin.toArrayList_964n92$(f);b.reverse(f);return f},reverse_355nu0$:function(f){f=a.kotlin.toArrayList_355nu0$(f);b.reverse(f);return f},reverse_bvy38t$:function(f){f=a.kotlin.toArrayList_bvy38t$(f);b.reverse(f);return f},reverse_rjqrz0$:function(f){f=a.kotlin.toArrayList_rjqrz0$(f);b.reverse(f);return f},reverse_tmsbgp$:function(f){f=
a.kotlin.toArrayList_tmsbgp$(f);b.reverse(f);return f},reverse_se6h4y$:function(f){f=a.kotlin.toArrayList_se6h4y$(f);b.reverse(f);return f},reverse_i2lc78$:function(f){f=a.kotlin.toArrayList_i2lc78$(f);b.reverse(f);return f},reverse_h3panj$:function(f){f=a.kotlin.toArrayList_h3panj$(f);b.reverse(f);return f},reverse_pdl1w0$:function(a){return(new b.StringBuilder).append(a).reverse().toString()},sort_h3panj$:function(f){f=a.kotlin.toArrayList_h3panj$(f);b.collectionsSort(f);return f},sortBy_lykrt4$:function(f,
d){var c=a.kotlin.toArrayList_2hx8bi$(f);b.collectionsSort(c,d);return c},sortBy_yknd17$:function(f,d){var c=a.kotlin.toArrayList_h3panj$(f);b.collectionsSort(c,d);return c},sortBy_de9h66$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},sortBy_de9h66$:function(f,d){var c=a.kotlin.toArrayList_2hx8bi$(f),e=b.comparator(a.kotlin.sortBy_de9h66$f(d));b.collectionsSort(c,e);return c},sortBy_vqr6wr$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},sortBy_vqr6wr$:function(f,
d){var c=a.kotlin.toArrayList_h3panj$(f),e=b.comparator(a.kotlin.sortBy_vqr6wr$f(d));b.collectionsSort(c,e);return c},sortDescending_h3panj$f:function(a,b){return-a.compareTo_za3rmp$(b)},sortDescending_h3panj$:function(f){f=a.kotlin.toArrayList_h3panj$(f);var d=b.comparator(a.kotlin.sortDescending_h3panj$f);b.collectionsSort(f,d);return f},sortDescendingBy_de9h66$f:function(a){return function(b,c){return-a(b).compareTo_za3rmp$(a(c))}},sortDescendingBy_de9h66$:function(f,d){var c=a.kotlin.toArrayList_2hx8bi$(f),
e=b.comparator(a.kotlin.sortDescendingBy_de9h66$f(d));b.collectionsSort(c,e);return c},sortDescendingBy_vqr6wr$f:function(a){return function(b,c){return-a(b).compareTo_za3rmp$(a(c))}},sortDescendingBy_vqr6wr$:function(f,d){var c=a.kotlin.toArrayList_h3panj$(f),e=b.comparator(a.kotlin.sortDescendingBy_vqr6wr$f(d));b.collectionsSort(c,e);return c},toSortedList_2hx8bi$:function(f){f=a.kotlin.toArrayList_2hx8bi$(f);b.collectionsSort(f);return f},toSortedList_l1lu5s$:function(f){f=a.kotlin.toArrayList_l1lu5s$(f);
b.collectionsSort(f);return f},toSortedList_964n92$:function(f){f=a.kotlin.toArrayList_964n92$(f);b.collectionsSort(f);return f},toSortedList_355nu0$:function(f){f=a.kotlin.toArrayList_355nu0$(f);b.collectionsSort(f);return f},toSortedList_bvy38t$:function(f){f=a.kotlin.toArrayList_bvy38t$(f);b.collectionsSort(f);return f},toSortedList_rjqrz0$:function(f){f=a.kotlin.toArrayList_rjqrz0$(f);b.collectionsSort(f);return f},toSortedList_tmsbgp$:function(f){f=a.kotlin.toArrayList_tmsbgp$(f);b.collectionsSort(f);
return f},toSortedList_se6h4y$:function(f){f=a.kotlin.toArrayList_se6h4y$(f);b.collectionsSort(f);return f},toSortedList_i2lc78$:function(f){f=a.kotlin.toArrayList_i2lc78$(f);b.collectionsSort(f);return f},toSortedList_h3panj$:function(f){f=a.kotlin.toArrayList_h3panj$(f);b.collectionsSort(f);return f},toSortedList_pdnvbz$:function(f){f=a.kotlin.toArrayList_pdnvbz$(f);b.collectionsSort(f);return f},toSortedListBy_de9h66$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_de9h66$:function(f,
d){var c=a.kotlin.toArrayList_2hx8bi$(f),e=b.comparator(a.kotlin.toSortedListBy_de9h66$f(d));b.collectionsSort(c,e);return c},toSortedListBy_50zxbw$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_50zxbw$:function(f,d){var c=a.kotlin.toArrayList_l1lu5s$(f),e=b.comparator(a.kotlin.toSortedListBy_50zxbw$f(d));b.collectionsSort(c,e);return c},toSortedListBy_x245au$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_x245au$:function(f,
d){var c=a.kotlin.toArrayList_964n92$(f),e=b.comparator(a.kotlin.toSortedListBy_x245au$f(d));b.collectionsSort(c,e);return c},toSortedListBy_h5ed0c$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_h5ed0c$:function(f,d){var c=a.kotlin.toArrayList_355nu0$(f),e=b.comparator(a.kotlin.toSortedListBy_h5ed0c$f(d));b.collectionsSort(c,e);return c},toSortedListBy_24jijj$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_24jijj$:function(f,
d){var c=a.kotlin.toArrayList_bvy38t$(f),e=b.comparator(a.kotlin.toSortedListBy_24jijj$f(d));b.collectionsSort(c,e);return c},toSortedListBy_im8pe8$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_im8pe8$:function(f,d){var c=a.kotlin.toArrayList_rjqrz0$(f),e=b.comparator(a.kotlin.toSortedListBy_im8pe8$f(d));b.collectionsSort(c,e);return c},toSortedListBy_1xntkt$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_1xntkt$:function(f,
d){var c=a.kotlin.toArrayList_tmsbgp$(f),e=b.comparator(a.kotlin.toSortedListBy_1xntkt$f(d));b.collectionsSort(c,e);return c},toSortedListBy_3cuuyy$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_3cuuyy$:function(f,d){var c=a.kotlin.toArrayList_se6h4y$(f),e=b.comparator(a.kotlin.toSortedListBy_3cuuyy$f(d));b.collectionsSort(c,e);return c},toSortedListBy_p67zio$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_p67zio$:function(f,
d){var c=a.kotlin.toArrayList_i2lc78$(f),e=b.comparator(a.kotlin.toSortedListBy_p67zio$f(d));b.collectionsSort(c,e);return c},toSortedListBy_vqr6wr$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_vqr6wr$:function(f,d){var c=a.kotlin.toArrayList_h3panj$(f),e=b.comparator(a.kotlin.toSortedListBy_vqr6wr$f(d));b.collectionsSort(c,e);return c},toSortedListBy_9fpnal$f:function(a){return function(b,c){return a(b).compareTo_za3rmp$(a(c))}},toSortedListBy_9fpnal$:function(f,
d){var c=a.kotlin.toArrayList_pdnvbz$(f),e=b.comparator(a.kotlin.toSortedListBy_9fpnal$f(d));b.collectionsSort(c,e);return c},isEmpty_2hx8bi$:function(a){return 0===a.length},isEmpty_l1lu5s$:function(a){return 0===a.length},isEmpty_964n92$:function(a){return 0===a.length},isEmpty_355nu0$:function(a){return 0===a.length},isEmpty_bvy38t$:function(a){return 0===a.length},isEmpty_rjqrz0$:function(a){return 0===a.length},isEmpty_tmsbgp$:function(a){return 0===a.length},isEmpty_se6h4y$:function(a){return 0===
a.length},isEmpty_i2lc78$:function(a){return 0===a.length},isNotEmpty_2hx8bi$:function(b){return!a.kotlin.isEmpty_2hx8bi$(b)},isNotEmpty_l1lu5s$:function(b){return!a.kotlin.isEmpty_l1lu5s$(b)},isNotEmpty_964n92$:function(b){return!a.kotlin.isEmpty_964n92$(b)},isNotEmpty_355nu0$:function(b){return!a.kotlin.isEmpty_355nu0$(b)},isNotEmpty_bvy38t$:function(b){return!a.kotlin.isEmpty_bvy38t$(b)},isNotEmpty_rjqrz0$:function(b){return!a.kotlin.isEmpty_rjqrz0$(b)},isNotEmpty_tmsbgp$:function(b){return!a.kotlin.isEmpty_tmsbgp$(b)},
isNotEmpty_se6h4y$:function(b){return!a.kotlin.isEmpty_se6h4y$(b)},isNotEmpty_i2lc78$:function(b){return!a.kotlin.isEmpty_i2lc78$(b)},all_de9h66$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)if(!b(a[e]))return!1;return!0},all_50zxbw$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(!d(e))return!1}return!0},all_x245au$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(!d(e))return!1}return!0},all_h5ed0c$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=
c.next();if(!d(e))return!1}return!0},all_24jijj$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(!d(e))return!1}return!0},all_im8pe8$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(!d(e))return!1}return!0},all_1xntkt$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)if(!b(a[e]))return!1;return!0},all_3cuuyy$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(!d(e))return!1}return!0},all_p67zio$:function(a,d){for(var c=
b.arrayIterator(a);c.hasNext();){var e=c.next();if(!d(e))return!1}return!0},all_vqr6wr$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();if(!b(e))return!1}return!0},all_gld13f$:function(b,d){for(var c=a.kotlin.iterator_s8ckw1$(b);c.hasNext();){var e=c.next();if(!d(e))return!1}return!0},all_9fpnal$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();if(!b(e))return!1}return!0},all_t73kuc$:function(b,d){for(var c=a.kotlin.iterator_gw00vq$(b);c.hasNext();){var e=c.next();
if(!d(e))return!1}return!0},any_2hx8bi$:function(a){for(a=a.length;0!==a;)return!0;return!1},any_l1lu5s$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!0;return!1},any_964n92$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!0;return!1},any_355nu0$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!0;return!1},any_bvy38t$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!0;return!1},any_rjqrz0$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),
!0;return!1},any_tmsbgp$:function(a){for(a=a.length;0!==a;)return!0;return!1},any_se6h4y$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!0;return!1},any_i2lc78$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!0;return!1},any_h3panj$:function(a){for(a=a.iterator();a.hasNext();)return a.next(),!0;return!1},any_s8ckw1$:function(b){for(b=a.kotlin.iterator_s8ckw1$(b);b.hasNext();)return b.next(),!0;return!1},any_pdnvbz$:function(a){for(a=a.iterator();a.hasNext();)return a.next(),
!0;return!1},any_pdl1w0$:function(b){for(b=a.kotlin.iterator_gw00vq$(b);b.hasNext();)return b.next(),!0;return!1},any_de9h66$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)if(b(a[e]))return!0;return!1},any_50zxbw$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!0}return!1},any_x245au$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!0}return!1},any_h5ed0c$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=
c.next();if(d(e))return!0}return!1},any_24jijj$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!0}return!1},any_im8pe8$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!0}return!1},any_1xntkt$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)if(b(a[e]))return!0;return!1},any_3cuuyy$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!0}return!1},any_p67zio$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=
c.next();if(d(e))return!0}return!1},any_vqr6wr$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();if(b(e))return!0}return!1},any_gld13f$:function(b,d){for(var c=a.kotlin.iterator_s8ckw1$(b);c.hasNext();){var e=c.next();if(d(e))return!0}return!1},any_9fpnal$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();if(b(e))return!0}return!1},any_t73kuc$:function(b,d){for(var c=a.kotlin.iterator_gw00vq$(b);c.hasNext();){var e=c.next();if(d(e))return!0}return!1},count_2hx8bi$:function(a){return a.length},
count_l1lu5s$:function(a){return a.length},count_964n92$:function(a){return a.length},count_355nu0$:function(a){return a.length},count_bvy38t$:function(a){return a.length},count_rjqrz0$:function(a){return a.length},count_tmsbgp$:function(a){return a.length},count_se6h4y$:function(a){return a.length},count_i2lc78$:function(a){return a.length},count_tkvw3h$:function(b){return a.kotlin.get_size_1(b)},count_h3panj$:function(a){var b=0;for(a=a.iterator();a.hasNext();)a.next(),b++;return b},count_s8ckw1$:function(b){return a.kotlin.get_size(b)},
count_pdnvbz$:function(a){var b=0;for(a=a.iterator();a.hasNext();)a.next(),b++;return b},count_pdl1w0$:function(b){return a.kotlin.get_size_0(b)},count_de9h66$:function(a,b){var c=0,e,g;e=a.length;for(g=0;g!==e;++g)b(a[g])&&c++;return c},count_50zxbw$:function(a,d){for(var c=0,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&c++}return c},count_x245au$:function(a,d){for(var c=0,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&c++}return c},count_h5ed0c$:function(a,d){for(var c=0,e=b.arrayIterator(a);e.hasNext();){var g=
e.next();d(g)&&c++}return c},count_24jijj$:function(a,d){for(var c=0,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&c++}return c},count_im8pe8$:function(a,d){for(var c=0,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&c++}return c},count_1xntkt$:function(a,b){var c=0,e,g;e=a.length;for(g=0;g!==e;++g)b(a[g])&&c++;return c},count_3cuuyy$:function(a,d){for(var c=0,e=b.arrayIterator(a);e.hasNext();){var g=e.next();d(g)&&c++}return c},count_p67zio$:function(a,d){for(var c=0,e=b.arrayIterator(a);e.hasNext();){var g=
e.next();d(g)&&c++}return c},count_vqr6wr$:function(a,b){for(var c=0,e=a.iterator();e.hasNext();){var g=e.next();b(g)&&c++}return c},count_gld13f$:function(b,d){for(var c=0,e=a.kotlin.iterator_s8ckw1$(b);e.hasNext();){var g=e.next();d(g)&&c++}return c},count_9fpnal$:function(a,b){for(var c=0,e=a.iterator();e.hasNext();){var g=e.next();b(g)&&c++}return c},count_t73kuc$:function(b,d){for(var c=0,e=a.kotlin.iterator_gw00vq$(b);e.hasNext();){var g=e.next();d(g)&&c++}return c},fold_8stajs$:function(a,
b,c){var e,g;e=a.length;for(g=0;g!==e;++g)b=c(b,a[g]);return b},fold_v8qmra$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d=c(d,e)}return d},fold_4lvz2o$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d=c(d,e)}return d},fold_gtjzry$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d=c(d,e)}return d},fold_pn2g5j$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d=c(d,e)}return d},fold_tj8q8m$:function(a,d,c){for(a=
b.arrayIterator(a);a.hasNext();){var e=a.next();d=c(d,e)}return d},fold_s4q4mb$:function(a,b,c){var e,g;e=a.length;for(g=0;g!==e;++g)b=c(b,a[g]);return b},fold_g9t0ho$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d=c(d,e)}return d},fold_8hjqyy$:function(a,d,c){for(a=b.arrayIterator(a);a.hasNext();){var e=a.next();d=c(d,e)}return d},fold_gu2wyd$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=a.next();b=c(b,e)}return b},fold_9hsf09$:function(a,b,c){for(a=a.iterator();a.hasNext();){var e=
a.next();b=c(b,e)}return b},fold_xn4ira$:function(b,d,c){for(b=a.kotlin.iterator_gw00vq$(b);b.hasNext();){var e=b.next();d=c(d,e)}return d},foldRight_8stajs$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_v8qmra$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_4lvz2o$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_gtjzry$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_pn2g5j$:function(a,
b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_tj8q8m$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_s4q4mb$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_g9t0ho$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_8hjqyy$:function(a,b,c){for(var e=a.length-1;0<=e;)b=c(a[e--],b);return b},foldRight_qwc90p$:function(b,d,c){for(var e=a.kotlin.get_size_1(b)-1;0<=e;)d=c(b.get_za3lpa$(e--),d);return d},
foldRight_xn4ira$:function(b,d,c){for(var e=a.kotlin.get_size_0(b)-1;0<=e;)d=c(b.charAt(e--),d);return d},forEach_de9h66$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)b(a[e])},forEach_50zxbw$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d(e)}},forEach_x245au$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d(e)}},forEach_h5ed0c$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d(e)}},forEach_24jijj$:function(a,d){for(var c=
b.arrayIterator(a);c.hasNext();){var e=c.next();d(e)}},forEach_im8pe8$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d(e)}},forEach_1xntkt$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)b(a[e])},forEach_3cuuyy$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d(e)}},forEach_p67zio$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();d(e)}},forEach_vqr6wr$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();b(e)}},
forEach_gld13f$:function(b,d){for(var c=a.kotlin.iterator_s8ckw1$(b);c.hasNext();){var e=c.next();d(e)}},forEach_9fpnal$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();b(e)}},forEach_t73kuc$:function(b,d){for(var c=a.kotlin.iterator_gw00vq$(b);c.hasNext();){var e=c.next();d(e)}},max_2hx8bi$:function(b){if(a.kotlin.isEmpty_2hx8bi$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_7(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_964n92$:function(b){if(a.kotlin.isEmpty_964n92$(b))return null;
var d=b[0],c;c=a.kotlin.get_lastIndex_0(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_355nu0$:function(b){if(a.kotlin.isEmpty_355nu0$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_6(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_bvy38t$:function(b){if(a.kotlin.isEmpty_bvy38t$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_5(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_rjqrz0$:function(b){if(a.kotlin.isEmpty_rjqrz0$(b))return null;
var d=b[0],c;c=a.kotlin.get_lastIndex_4(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_tmsbgp$:function(b){if(a.kotlin.isEmpty_tmsbgp$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_2(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_se6h4y$:function(b){if(a.kotlin.isEmpty_se6h4y$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_3(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_i2lc78$:function(b){if(a.kotlin.isEmpty_i2lc78$(b))return null;
var d=b[0],c;c=a.kotlin.get_lastIndex_1(b)+1;for(var e=1;e!==c;e++){var g=b[e];d<g&&(d=g)}return d},max_h3panj$:function(a){a=a.iterator();if(!a.hasNext())return null;for(var b=a.next();a.hasNext();){var c=a.next();b<c&&(b=c)}return b},max_pdnvbz$:function(a){a=a.iterator();if(!a.hasNext())return null;for(var b=a.next();a.hasNext();){var c=a.next();b<c&&(b=c)}return b},max_pdl1w0$:function(b){b=a.kotlin.iterator_gw00vq$(b);if(!b.hasNext())return null;for(var d=b.next();b.hasNext();){var c=b.next();
d<c&&(d=c)}return d},maxBy_de9h66$:function(b,d){if(a.kotlin.isEmpty_2hx8bi$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_7(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_50zxbw$:function(b,d){if(a.kotlin.isEmpty_l1lu5s$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_x245au$:function(b,d){if(a.kotlin.isEmpty_964n92$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_0(b)+
1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_h5ed0c$:function(b,d){if(a.kotlin.isEmpty_355nu0$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_6(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_24jijj$:function(b,d){if(a.kotlin.isEmpty_bvy38t$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_5(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_im8pe8$:function(b,d){if(a.kotlin.isEmpty_rjqrz0$(b))return null;
var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_4(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_1xntkt$:function(b,d){if(a.kotlin.isEmpty_tmsbgp$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_2(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_3cuuyy$:function(b,d){if(a.kotlin.isEmpty_se6h4y$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_3(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_p67zio$:function(b,
d){if(a.kotlin.isEmpty_i2lc78$(b))return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_1(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e<z&&(c=x,e=z)}return c},maxBy_vqr6wr$:function(a,b){var c=a.iterator();if(!c.hasNext())return null;for(var e=c.next(),g=b(e);c.hasNext();){var k=c.next(),x=b(k);g<x&&(e=k,g=x)}return e},maxBy_9fpnal$:function(a,b){var c=a.iterator();if(!c.hasNext())return null;for(var e=c.next(),g=b(e);c.hasNext();){var k=c.next(),x=b(k);g<x&&(e=k,g=x)}return e},maxBy_t73kuc$:function(b,
d){var c=a.kotlin.iterator_gw00vq$(b);if(!c.hasNext())return null;for(var e=c.next(),g=d(e);c.hasNext();){var k=c.next(),x=d(k);g<x&&(e=k,g=x)}return e},maxBy_gld13f$:function(b,d){var c=a.kotlin.iterator_s8ckw1$(b);if(!c.hasNext())return null;for(var e=c.next(),g=d(e);c.hasNext();){var k=c.next(),x=d(k);g<x&&(e=k,g=x)}return e},min_2hx8bi$:function(b){if(a.kotlin.isEmpty_2hx8bi$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_7(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_964n92$:function(b){if(a.kotlin.isEmpty_964n92$(b))return null;
var d=b[0],c;c=a.kotlin.get_lastIndex_0(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_355nu0$:function(b){if(a.kotlin.isEmpty_355nu0$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_6(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_bvy38t$:function(b){if(a.kotlin.isEmpty_bvy38t$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_5(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_rjqrz0$:function(b){if(a.kotlin.isEmpty_rjqrz0$(b))return null;
var d=b[0],c;c=a.kotlin.get_lastIndex_4(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_tmsbgp$:function(b){if(a.kotlin.isEmpty_tmsbgp$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_2(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_se6h4y$:function(b){if(a.kotlin.isEmpty_se6h4y$(b))return null;var d=b[0],c;c=a.kotlin.get_lastIndex_3(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_i2lc78$:function(b){if(a.kotlin.isEmpty_i2lc78$(b))return null;
var d=b[0],c;c=a.kotlin.get_lastIndex_1(b)+1;for(var e=1;e!==c;e++){var g=b[e];d>g&&(d=g)}return d},min_h3panj$:function(a){a=a.iterator();if(!a.hasNext())return null;for(var b=a.next();a.hasNext();){var c=a.next();b>c&&(b=c)}return b},min_pdnvbz$:function(a){a=a.iterator();if(!a.hasNext())return null;for(var b=a.next();a.hasNext();){var c=a.next();b>c&&(b=c)}return b},min_pdl1w0$:function(b){b=a.kotlin.iterator_gw00vq$(b);if(!b.hasNext())return null;for(var d=b.next();b.hasNext();){var c=b.next();
d>c&&(d=c)}return d},minBy_de9h66$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_7(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_50zxbw$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_x245au$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_0(b)+1;for(var k=1;k!==g;k++){var x=
b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_h5ed0c$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_6(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_24jijj$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_5(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_im8pe8$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_4(b)+1;for(var k=
1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_1xntkt$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_2(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_3cuuyy$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_3(b)+1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_p67zio$:function(b,d){if(0===b.length)return null;var c=b[0],e=d(c),g;g=a.kotlin.get_lastIndex_1(b)+
1;for(var k=1;k!==g;k++){var x=b[k],z=d(x);e>z&&(c=x,e=z)}return c},minBy_vqr6wr$:function(a,b){var c=a.iterator();if(!c.hasNext())return null;for(var e=c.next(),g=b(e);c.hasNext();){var k=c.next(),x=b(k);g>x&&(e=k,g=x)}return e},minBy_9fpnal$:function(a,b){var c=a.iterator();if(!c.hasNext())return null;for(var e=c.next(),g=b(e);c.hasNext();){var k=c.next(),x=b(k);g>x&&(e=k,g=x)}return e},minBy_t73kuc$:function(b,d){var c=a.kotlin.iterator_gw00vq$(b);if(!c.hasNext())return null;for(var e=c.next(),
g=d(e);c.hasNext();){var k=c.next(),x=d(k);g>x&&(e=k,g=x)}return e},minBy_gld13f$:function(b,d){var c=a.kotlin.iterator_s8ckw1$(b);if(!c.hasNext())return null;for(var e=c.next(),g=d(e);c.hasNext();){var k=c.next(),x=d(k);g>x&&(e=k,g=x)}return e},none_2hx8bi$:function(a){for(a=a.length;0!==a;)return!1;return!0},none_l1lu5s$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!1;return!0},none_964n92$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!1;return!0},none_355nu0$:function(a){for(a=
b.arrayIterator(a);a.hasNext();)return a.next(),!1;return!0},none_bvy38t$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!1;return!0},none_rjqrz0$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!1;return!0},none_tmsbgp$:function(a){for(a=a.length;0!==a;)return!1;return!0},none_se6h4y$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!1;return!0},none_i2lc78$:function(a){for(a=b.arrayIterator(a);a.hasNext();)return a.next(),!1;return!0},none_h3panj$:function(a){for(a=
a.iterator();a.hasNext();)return a.next(),!1;return!0},none_s8ckw1$:function(b){for(b=a.kotlin.iterator_s8ckw1$(b);b.hasNext();)return b.next(),!1;return!0},none_pdnvbz$:function(a){for(a=a.iterator();a.hasNext();)return a.next(),!1;return!0},none_pdl1w0$:function(b){for(b=a.kotlin.iterator_gw00vq$(b);b.hasNext();)return b.next(),!1;return!0},none_de9h66$:function(a,b){var c,e;c=a.length;for(e=0;e!==c;++e)if(b(a[e]))return!1;return!0},none_50zxbw$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=
c.next();if(d(e))return!1}return!0},none_x245au$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},none_h5ed0c$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},none_24jijj$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},none_im8pe8$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},none_1xntkt$:function(a,
b){var c,e;c=a.length;for(e=0;e!==c;++e)if(b(a[e]))return!1;return!0},none_3cuuyy$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},none_p67zio$:function(a,d){for(var c=b.arrayIterator(a);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},none_vqr6wr$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();if(b(e))return!1}return!0},none_gld13f$:function(b,d){for(var c=a.kotlin.iterator_s8ckw1$(b);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},
none_9fpnal$:function(a,b){for(var c=a.iterator();c.hasNext();){var e=c.next();if(b(e))return!1}return!0},none_t73kuc$:function(b,d){for(var c=a.kotlin.iterator_gw00vq$(b);c.hasNext();){var e=c.next();if(d(e))return!1}return!0},reduce_de9h67$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_50zxbx$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");
for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_x245av$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_h5ed0b$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_24jijk$:function(a,d){var c=
b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_im8pe7$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_1xntks$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");
for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_3cuuyz$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_p67zip$:function(a,d){var c=b.arrayIterator(a);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_vqr6ws$:function(a,d){var c=
a.iterator();if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_9fpnam$:function(a,d){var c=a.iterator();if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduce_t73kub$:function(f,d){var c=a.kotlin.iterator_gw00vq$(f);if(!c.hasNext())throw new b.UnsupportedOperationException("Empty iterable can't be reduced");
for(var e=c.next();c.hasNext();)e=d(e,c.next());return e},reduceRight_de9h67$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_50zxbx$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_x245av$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");
for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_h5ed0b$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_24jijk$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_im8pe7$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");
for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_1xntks$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_3cuuyz$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_p67zip$:function(a,d){var c=a.length-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");
for(var e=a[c--];0<=c;)e=d(a[c--],e);return e},reduceRight_7bxqi8$:function(f,d){var c=a.kotlin.get_size_1(f)-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=f.get_za3lpa$(c--);0<=c;)e=d(f.get_za3lpa$(c--),e);return e},reduceRight_t73kub$:function(f,d){var c=a.kotlin.get_size_0(f)-1;if(0>c)throw new b.UnsupportedOperationException("Empty iterable can't be reduced");for(var e=f.charAt(c--);0<=c;)e=d(f.charAt(c--),e);return e},support:b.definePackage(function(){this.State=
b.createObject(null,function(){this.Ready=0;this.NotReady=1;this.Done=2;this.Failed=3})},{AbstractIterator:b.createClass(function(){return[b.Iterator]},function(){this.state_xrvatb$=a.kotlin.support.State.NotReady;this.nextValue_u0jzfw$=null},{hasNext:function(){a.kotlin.require_eltq40$(this.state_xrvatb$!==a.kotlin.support.State.Failed);var b=this.state_xrvatb$;return b===a.kotlin.support.State.Done?!1:b===a.kotlin.support.State.Ready?!0:this.tryToComputeNext()},next:function(){if(!this.hasNext())throw new b.NoSuchElementException;
this.state_xrvatb$=a.kotlin.support.State.NotReady;return this.nextValue_u0jzfw$},peek:function(){if(!this.hasNext())throw new b.NoSuchElementException;return this.nextValue_u0jzfw$},tryToComputeNext:function(){this.state_xrvatb$=a.kotlin.support.State.Failed;this.computeNext();return this.state_xrvatb$===a.kotlin.support.State.Ready},setNext_za3rmp$:function(b){this.nextValue_u0jzfw$=b;this.state_xrvatb$=a.kotlin.support.State.Ready},done:function(){this.state_xrvatb$=a.kotlin.support.State.Done}})})})});
b.defineModule("pcm",a)})(Kotlin);"undefined"!=typeof module&&(module.exports=Kotlin.modules.pcm);/*
 jQuery UI Slider plugin wrapper
 */
angular.module('ui.slider', []).value('uiSliderConfig',{}).directive('uiSlider', ['uiSliderConfig', '$timeout', function(uiSliderConfig, $timeout) {
  uiSliderConfig = uiSliderConfig || {};
  return {
    require: 'ngModel',
    compile: function() {
      var preLink = function (scope, elm, attrs, ngModel) {

        function parseNumber(n, decimals) {
          return (decimals) ? parseFloat(n) : parseInt(n, 10);
        }

        var options = angular.extend(scope.$eval(attrs.uiSlider) || {}, uiSliderConfig);
        // Object holding range values
        var prevRangeValues = {
          min: null,
          max: null
        };

        // convenience properties
        var properties = ['min', 'max', 'step', 'lowerBound', 'upperBound'];
        var useDecimals = (!angular.isUndefined(attrs.useDecimals)) ? true : false;

        var init = function() {
          // When ngModel is assigned an array of values then range is expected to be true.
          // Warn user and change range to true else an error occurs when trying to drag handle
          if (angular.isArray(ngModel.$viewValue) && options.range !== true) {
            console.warn('Change your range option of ui-slider. When assigning ngModel an array of values then the range option should be set to true.');
            options.range = true;
          }

          // Ensure the convenience properties are passed as options if they're defined
          // This avoids init ordering issues where the slider's initial state (eg handle
          // position) is calculated using widget defaults
          // Note the properties take precedence over any duplicates in options
          angular.forEach(properties, function(property) {
            if (angular.isDefined(attrs[property])) {
              options[property] = parseNumber(attrs[property], useDecimals);
            }
          });

          elm.slider(options);
          init = angular.noop;
        };

        // Find out if decimals are to be used for slider
        angular.forEach(properties, function(property) {
          // support {{}} and watch for updates
          attrs.$observe(property, function(newVal) {
            if (!!newVal) {
              init();
              options[property] = parseNumber(newVal, useDecimals);
              elm.slider('option', property, parseNumber(newVal, useDecimals));
              ngModel.$render();
            }
          });
        });
        attrs.$observe('disabled', function(newVal) {
          init();
          elm.slider('option', 'disabled', !!newVal);
        });

        // Watch ui-slider (byVal) for changes and update
        scope.$watch(attrs.uiSlider, function(newVal) {
          init();
          if(newVal !== undefined) {
            elm.slider('option', newVal);
          }
        }, true);

        // Late-bind to prevent compiler clobbering
        $timeout(init, 0, true);

        // Update model value from slider
        elm.bind('slide', function(event, ui) {
          var valuesChanged;

          if (ui.values) {
            var boundedValues = ui.values.slice();

            if (options.lowerBound && boundedValues[0] < options.lowerBound) {
              boundedValues[0] = Math.max(boundedValues[0], options.lowerBound);
            }
            if (options.upperBound && boundedValues[1] > options.upperBound) {
              boundedValues[1] = Math.min(boundedValues[1], options.upperBound);
            }

            if (boundedValues[0] !== ui.values[0] || boundedValues[1] !== ui.values[1]) {
              valuesChanged = true;
              ui.values = boundedValues;
            }
          } else {
            var boundedValue = ui.value;

            if (options.lowerBound && boundedValue < options.lowerBound) {
              boundedValue = Math.max(boundedValue, options.lowerBound);
            }
            if (options.upperBound && boundedValue > options.upperBound) {
              boundedValue = Math.min(boundedValue, options.upperBound);
            }

            if (boundedValue !== ui.value) {
              valuesChanged = true;
              ui.value = boundedValue;
            }
          }


          ngModel.$setViewValue(ui.values || ui.value);
          scope.$apply();

          if (valuesChanged) {
            setTimeout(function() {
              elm.slider('value', ui.values || ui.value);
            }, 0);

            return false;
          }
        });

        // Update slider from model value
        ngModel.$render = function() {
          init();
          var method = options.range === true ? 'values' : 'value';

          if (options.range !== true && isNaN(ngModel.$viewValue) && !(ngModel.$viewValue instanceof Array)) {
            ngModel.$viewValue = 0;
          }
          else if (options.range && !angular.isDefined(ngModel.$viewValue)) {
            ngModel.$viewValue = [0,0];
          }

          // Do some sanity check of range values
          if (options.range === true) {

            // Check outer bounds for min and max values
            if (angular.isDefined(options.min) && options.min > ngModel.$viewValue[0]) {
              ngModel.$viewValue[0] = options.min;
            }
            if (angular.isDefined(options.max) && options.max < ngModel.$viewValue[1]) {
              ngModel.$viewValue[1] = options.max;
            }

            // Check min and max range values
            if (ngModel.$viewValue[0] > ngModel.$viewValue[1]) {
              // Min value should be less to equal to max value
              if (prevRangeValues.min >= ngModel.$viewValue[1]) {
                ngModel.$viewValue[0] = prevRangeValues.min;
              }
              // Max value should be less to equal to min value
              if (prevRangeValues.max <= ngModel.$viewValue[0]) {
                ngModel.$viewValue[1] = prevRangeValues.max;
              }
            }

            // Store values for later user
            prevRangeValues.min = ngModel.$viewValue[0];
            prevRangeValues.max = ngModel.$viewValue[1];

          }
          elm.slider(method, ngModel.$viewValue);
        };

        scope.$watch(attrs.ngModel, function() {
          if (options.range === true) {
            ngModel.$render();
          }
        }, true);

        function destroy() {
          if (elm.hasClass('ui-slider')) {
            elm.slider('destroy');
          }
        }

        scope.$on("$destroy", destroy);
        elm.one('$destroy', destroy);
      };

      var postLink = function (scope, element, attrs, ngModel) {
        // Add tick marks if 'tick' and 'step' attributes have been setted on element.
        // Support horizontal slider bar so far. 'tick' and 'step' attributes are required.
        var options = angular.extend({}, scope.$eval(attrs.uiSlider));
        var properties = ['max', 'step', 'tick'];
        angular.forEach(properties, function(property) {
          if (angular.isDefined(attrs[property])) {
            options[property] = attrs[property];
          }
        });
        if (angular.isDefined(options['tick']) && angular.isDefined(options['step'])) {
          var total = parseInt(parseInt(options['max'])/parseInt(options['step']));
          for (var i = total; i >= 0; i--) {
            var left = ((i / total) * 100) + '%';
            $("<div/>").addClass("ui-slider-tick").appendTo(element).css({left: left});
          };
        }
      }

      return {
        pre: preLink,
        post: postLink
      };
    }
  };
}]);

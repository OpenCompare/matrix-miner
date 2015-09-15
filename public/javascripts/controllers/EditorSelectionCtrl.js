/**
 * Created by gbecan on 7/7/15.
 */


angular
    .module("matrixMinerApp")
    .controller("EditorSelectionCtrl", function($rootScope, $scope, expandeditor) {

    expandeditor.expandNavigateFunctions(function(newRowCol, oldRowCol) {
        var feature = newRowCol.col.name;
        var product = newRowCol.row.entity.name;
        var cell = newRowCol.row.entity[newRowCol.col.name];
        $rootScope.$broadcast("selection", product, feature, cell);
        console.log(feature + ", " + product + " : " + cell);
    }).addFunction();

});
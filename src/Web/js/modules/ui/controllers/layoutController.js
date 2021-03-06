﻿angular.module('hadouken.ui.controllers.layout', [
    'hadouken.messaging'
])
.controller('UI.LayoutController', [
    '$scope', 'messageService',
    function ($scope, messageService) {
        $scope.settingsItems = {};
        $scope.menuItems = {};

        messageService.subscribe('ui.settings.menuItem.add', function(event, params) {
            if ($scope.settingsItems[params.state]) return;
            $scope.settingsItems[params.state] = params;
        });

        messageService.subscribe('ui.menuItem.add', function(event, params) {
            if ($scope.menuItems[params.state]) return;
            $scope.menuItems[params.state] = params;
        });

        messageService.publish('ui.onloaded', {});
    }
]);
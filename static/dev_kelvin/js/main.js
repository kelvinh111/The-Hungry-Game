var hungry = angular.module("hungry", [])

.controller('hungryCtrl', ['$scope', '$interval', '$timeout', function($scope, $interval, $timeout) {

    var socket;
    var $window = $(window);
    var $body = $('body');
    var $app = $('#app');
    var appMaxHeight = 800;
    var lunchHour = 13; // 1:00
    var lunchMin = 30;
    var lunch = moment({hour:lunchHour, minute:lunchMin}).format("X") * 1000;
    var gameLength = 30; // default 30 mins 
    var gameLengthTs = gameLength * 60 * 1000;
    var timerWidth = $("#main > header").width();
    var popup = $("#popup");
    var popupTimer;

    $scope.gameStarted = false;
    $scope.timeLeft = "Loading";
    $scope.progressWidth = 0;
    $scope.connected = false;
    $scope.peoplesList = null;
    $scope.shopsList = null;
    $scope.joined = false;
    $scope.voted = false;
    $scope.myId = null;
    $scope.myName = null;
    $scope.myShopId = null;
    $scope.myShopName = null;
    $scope.popup = "";

    var centerApp = function() {
        var winH = $window.height();
        if (winH <= appMaxHeight) {
            $app.css({
                'height': '100%',
                'margin-top': 0
            });
        } else {
            $app.css({
                'height': appMaxHeight,
                'margin-top': (winH - appMaxHeight) / 2 + 'px'
            });
        }
    }

    // $('#bg').particleground({
    //     dotColor: '#ffffff',
    //     lineColor: '#ffffff'
    // });

    var showMsg = function(msg) {
        $timeout(function() {
            $scope.$apply();
        })
        if (msg == "notStarted") {
            popup.text("The game is not started yet");
        } else {
            popup.text(msg);
        }

        $timeout.cancel(popupTimer);
        popup.addClass('active');
        popupTimer = $timeout(function() {
            popup.removeClass('active');
        }, 3000, true);
    }

    $scope.selectPeople = function(id) {
        // console.log($scope.gameStarted)
        // console.log(id);
        if (!$scope.gameStarted) {
            showMsg("notStarted");
            return;
        }
        socket.emit('join', parseInt(id), function(event, msg) {
            // showMsg(msg);
            if (event == "not_started") {
                showMsg("notStarted");
            }

            else if (event == "join") {
                $scope.joined = true;
                $scope.myId = id;
                $.cookie('myId', id);
                $scope.myName = $scope.peoples[id].name;
            }

            else if (event == "change_user") {
                $scope.joined = true;
                $scope.myId = id;
                $.cookie('myId', id);
                $scope.myName = $scope.peoples[id].name;
                $scope.voted = false;
                $scope.myShopId = null;
                $scope.myShopName = null;
            }

            else if (event == "cant_join") {
                showMsg(msg);
            }

            else if (event == "unjoin") {
                $scope.joined = false;
                $scope.myId = null;
                $scope.myName = null;
                $scope.voted = false;
                $scope.myShopId = null;
                $scope.myShopName = null;
            }

            // $scope.$apply();
        });
    }

    $scope.selectShop = function(id) {
        if (!$scope.gameStarted) {
            showMsg("notStarted");
            return;
        }
        socket.emit('vote', parseInt(id), function(event, msg) {
            if (event == "not_started") {
                showMsg("notStarted");
            }

            if (event == "vote") {
                $scope.voted = true;
                $scope.myShopId = id;
                $scope.myShopName = $scope.shops[id].name;
            }

            else if (event == "cant_vote") {
                showMsg(msg);
            }

            else if (event == "unvote") {
                $scope.voted = false;
                $scope.myShopId = null;
                $scope.myShopName = null;
            }

            // $scope.$apply();
        });
    }

    $scope.isMe = function(peopleId) {
        if (peopleId == $scope.myId) {
            return "me";
        }
        return null;
    }

    $scope.isMyShop = function(shopId) {
        if (shopId == $scope.myShopId) {
            return "me";
        }
        return null;
    }

    $scope.addingShop = false;
    var inputBox = $('#input-shop');
    inputBox.blur(function(e) {
        $scope.addingShop = false;
    })
    inputBox.keyup(function(e) {
        if (e.keyCode == 13) {
            $scope.addingShop = false;
            inputBox.blur();
            var newShop = $(this).val();
            if (newShop.length > 0) {
                socket.emit("addshop", newShop, function(event, msg) {
                    if (event == "not_started") {
                        showMsg("notStarted");
                    }

                    else if (event == "cant_addshop") {
                        showMsg(msg);
                    }

                    else if (event == "addshop") {
                        showMsg("You added " + newShop);
                    }
                });
                $(this).val("");
            }
        }
    })
    $scope.addShop = function() {
        if ($scope.gameStarted) {
            if ($scope.joined) {
                $scope.addingShop = true;
                $timeout(function() {
                    inputBox.focus();
                }, 0);
            } else {
                showMsg("You must join first")
            }
        } else {
            showMsg("notStarted");
        }
    }

    socket = io.connect('/hungry');

    socket.on('connect', function(){
        showMsg("You are connected");
        $scope.connected = true;
        // console.log("start timer");
        // $scope.gameStarted = true;
        // console.log("disable shop selecting");
        // console.log("tip: please join");
        // $scope.$apply();
    });

    socket.on('disconnect', function() {
        showMsg("You are disconnected");
        for(var i in $scope.peoples) {
            $scope.peoples[i].joined = false;
        }
        $scope.connected = false;
        $scope.joined = false;
        $scope.myId = null;
        $scope.myName = null;
        $scope.voted = false;
        $scope.myShopId = null;
        $scope.myShopName = null;
        $scope.$apply();
    })

    socket.on('init', function(data) {
        // console.log("got peoples & shops list");
        // console.log("peoples list: " , data[0])
        // console.log("shops list: " , data[1])
        // console.log(data);
        $scope.peoplesList = data[0];
        $scope.shopsList = data[1];
        lunchHour = data[2][0];
        lunchMin = data[2][1];
        gameLength = data[2][2];
        lunch = moment({hour:lunchHour, minute:lunchMin}).format("X") * 1000;
        gameLengthTs = gameLength * 60 * 1000;
        // $scope.$apply();
        // var lunch = moment().add(1, 'm').format("X") * 1000;
        // var lunch = moment().subtract(1, 'm').format("X") * 1000;
        var longTimer = $interval(function() {
            var now = moment().valueOf()
            var timeLeft = lunch - now;
            if (timeLeft >= 0 && timeLeft < gameLengthTs) {
                $interval.cancel(longTimer);
                $scope.gameStarted = true;
                showMsg("Please select your name");
                var shortTimer = $interval(function() {
                    var now = moment().valueOf()
                    var timeLeft = lunch - now;
                    if (timeLeft <= 0) {
                        $scope.timeLeft = "Time's Up";
                        $scope.msg = "The game is not started yet"
                        $scope.progressWidth = "100%";
                        $scope.gameStarted = false;
                        $interval.cancel(shortTimer);
                    } else {
                        var date = new Date(timeLeft);
                        var m = date.getMinutes();
                        var s = date.getSeconds();
                        var n = date.getMilliseconds();

                        if (s < 10) s = "0" + s;
                        n = Math.floor(n / 100);
                        // if (n < 10) n = "0" + n;

                        $scope.timeLeft = m + ":" + s + ":" + n;
                        $scope.progressWidth = (((gameLengthTs - timeLeft) / gameLengthTs) * timerWidth) + "px";
                    }
                }, 100);
            } else {
                $scope.timeLeft = "Waiting for next lunch";
            }
        }, 1000);

    });

    // auto login with cookie when game started
    $scope.$watch('[gameStarted]', function () { 
        var id = $.cookie('myId');
        if ($scope.gameStarted == true && Number(id)) {
            $scope.selectPeople($.cookie('myId'));
        }
    }, true);

    socket.on('status', function(status) {
        // console.log("got status");
        // console.log(status);
        // console.log("update UI");
        var ppl = new Array();
        var sh = new Array();

        for (id in status.people) {
            var obj = {
                'id': id,
                'name': status.people[id].name,
                'joined': status.people[id].joined
            }
            ppl.push(obj);
        }

        for (id in status.shop) {
            var obj = {
                'id': id,
                'name': status.shop[id].name
            }
            var voter = new Array();
            for (pid in status.people) {
                if (status.people[pid].shop == id) {
                    voter.push(pid);
                }
            }
            obj.voter = voter;
            sh.push(obj);
        }
        // console.log(ppl);
        // console.log(sh);

        $scope.peoples = ppl;
        $scope.shops = sh;
        // $scope.$apply();
    });

    socket.on('system', function(msg) {
        showMsg(msg);
    });

    centerApp();

    $window.resize(function() {
        centerApp();
    })

    $window.unload(function() {
        socket.disconnect();
    });

}])

.filter('sortVotedShops', function() {
    return function(items) {
        var result = _.sortBy(items, function(item) {
            return item.voter.length;
        })

        return result.reverse();
    }
})

.filter('makeChampion', function() {
    return function(items) {
        var max = 0;
        for (var i in items) {
            if (items[i].voter.length > max) {
                max = items[i].voter.length;
            }
        }
        if (max) {
            for (var i in items) {
                if (items[i].voter.length >= max) {
                    items[i].champion = "champion";
                }
            }
        }

        return items;

    }
})

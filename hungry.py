# -*- coding: utf-8 -*-

from gevent import monkey
from flask import Flask, Response, render_template, request
from socketio import socketio_manage
from socketio.namespace import BaseNamespace
from socketio.mixins import BroadcastMixin
from datetime import datetime, time
import pytz
import random
import threading

monkey.patch_all()

app = Flask(__name__)
app.debug = True
app.config['DEBUG'] = True
app.config['PORT'] = 5000

peoples = ['Andy', 'Gordon', 'Heiley', 'Henry', 'Ho', 'Jan', 'Kelvin', 'Kristin', 'Matt', 'Thomas']
shops = ['Garden', 'Coffee', '新境界', 'Factory 99', '開餐達人', 'Food Court', '爭鮮', 'Drink Tea', 'Shabu SEN']
status = {
    'shop': [{
        'name': shop
    } for shop in shops],
    'people': [{
        'name': people,
        'joined': False,
        'shop': None
    } for people in peoples]
}

game_started = False
tz = pytz.timezone('Asia/Hong_Kong')
timer = None
timer_count = 0
lunch_hour = 13
lunch_min = 45
game_length = 45

def set_interval(interval):
    def decorator(function):
        def wrapper(*args, **kwargs):
            stopped = threading.Event()

            def loop(): # executed in another thread
                while not stopped.wait(interval): # until stopped
                    function(*args, **kwargs)

            t = threading.Thread(target=loop)
            t.daemon = True # stop if the program exits
            t.start()
            return stopped
        return wrapper
    return decorator


@set_interval(1)
def check_time():
    global game_started
    global timer_count

    now = datetime.now(tz)
    lunch_time = tz.localize(datetime(now.year, now.month, now.day, lunch_hour, lunch_min, 0), is_dst=None)
    time_left = int((lunch_time - now).total_seconds())

    if time_left > 0 and time_left < (game_length * 60):
        if game_started != True:
            print("GAME JUST STARTED");
            game_started = True
    else:
        if game_started != False:
            print("GAME JUST STOPED");
            game_started = False

    if timer_count % 30 == 0:
        print(time_left, game_started);
    timer_count = timer_count + 1

timer = check_time()

class HungryNamespace(BaseNamespace, BroadcastMixin):

    def log(self, message):
        now = datetime.now(tz)
        self.logger.info("[%s/%s/%s %s:%s:%s] %s" % (now.year, now.month, now.day, now.hour, now.minute, now.second, message))
        # print "[%s:%s:%s] %s" % (now.hour, now.minute, now.second, message);

    def initialize(self):
        self.logger = app.logger
        self.log("Socketio session started")

    def recv_connect(self):
        self.log("New connection")
        self.session['id'] = None
        self.session['name'] = None
        self.session['shop_id'] = None
        self.session['shop_name'] = None
        self.emit("init", (peoples, shops, [lunch_hour, lunch_min, game_length]))
        self.broadcast_event("status", status)

    def recv_disconnect(self):
        if self.session["id"] != None:
            people_id = self.session['id']
            people_name = peoples[people_id]
            status['people'][people_id]['joined'] = False
            # status['people'][people_id]['shop'] = None
            self.log("%s disconnected" % people_name)
            self.broadcast_event_not_me("status", status)
            self.broadcast_event_not_me("system", "%s disconnected" % people_name)
        else:
            self.log("Client disconnected")

    def broadcast_status(self):
        self.emit("status", status)

    def on_join(self, people_id):
        if game_started == False:
            return "not_started", "The game is not started yet"

        self.log(people_id)
        people_name = peoples[people_id]

        # if select his name, means sign out
        if self.session['id'] == people_id:
            status['people'][people_id]['joined'] = False
            status['people'][people_id]['shop'] = None
            self.broadcast_event("status", status)
            self.session['id'] = None
            self.session['name'] = None
            msg = "%s unjoined" % people_name
            self.log(msg)
            return "unjoin", msg
        elif status['people'][people_id]['joined'] == True:
            # can't select someone that already joined
            # this shouldn't happen becoz checked in frontend
            return "cant_join", "You can't select other user"
        else:
            # change to other user
            if self.session['id'] != None:
                original_name = self.session['name']
                status['people'][self.session['id']]['joined'] = False
                status['people'][self.session['id']]['shop'] = None
                status['people'][people_id]['joined'] = True
                self.broadcast_event("status", status)
                self.session['id'] = people_id
                self.session['name'] = people_name
                self.session['shop_id'] = None
                self.session['shop_name'] = None
                msg = "%s changed to %s" % (original_name, people_name)
                self.log(msg)
                return "change_user", msg
            # new join
            else:
                status['people'][people_id]['joined'] = True
                self.broadcast_event("status", status)
                self.session['id'] = people_id
                self.session['name'] = people_name
                self.session['shop_id'] = None
                self.session['shop_name'] = None
                msg = "%s joined" % people_name
                self.log(msg)
                return "join", msg

    def on_vote(self, shop_id):
        if game_started == False:
            return "not_started", "The game is not started yet"

        # must have joined, then can vote
        if self.session['id'] != None:
            shop_name = shops[shop_id]
            people_id = self.session['id']
            people_name = self.session['name']

            # if vote a shop that already voted, means cancel voting this shop
            if self.session['shop_id'] == shop_id:
                status['people'][people_id]['shop'] = None
                self.broadcast_event("status", status)
                self.session['shop_id'] = None
                self.session['shop_name'] = None
                msg = "%s unvoted %s" % (people_name, shop_name)
                self.log(msg)
                return "unvote", msg
            else:
                status['people'][people_id]['shop'] = shop_id
                self.broadcast_event("status", status)
                self.session['shop_id'] = shop_id
                self.session['shop_name'] = shop_name
                msg = "%s voted %s" % (people_name, shop_name)
                self.log(msg)
                return "vote", msg
        else:
            return "cant_vote", "You must join first"

    def on_addshop(self, shop_name):
        if game_started == False:
            return "not_started", "The game is not started yet"

        people_name = self.session['name']

        # check if new suggested shop is in shops list
        if not shop_name.lower() in (shop.lower() for shop in shops):
            shops.append(shop_name)
            status['shop'].append({'name': shop_name})
            self.broadcast_event("status", status)
            msg = "%s added %s" % (people_name, shop_name)
            self.broadcast_event_not_me("system", msg)
            self.log(msg)
            return "addshop", msg
        else:
            return "cant_addshop", "%s is already in the shops list" % shop_name


@app.route('/dev', methods=['GET'])
def index_dev():
    return render_template('index.html', mode='dev', peoples=peoples, shops=shops)

@app.route('/', methods=['GET'])
def index_prod():
    return render_template('index.html', mode='prod', peoples=peoples, shops=shops)

@app.route('/socket.io/<path:remaining>')
def socketio(remaining):
    try:
        socketio_manage(request.environ, {'/hungry': HungryNamespace}, request)
    except:
        app.logger.error("Exception while handling socketio connection",
                         exc_info=True)
    return Response()
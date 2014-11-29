from hungry import app
from gevent import monkey
from socketio.server import SocketIOServer
import logging
from logging.handlers import RotatingFileHandler

monkey.patch_all()


if __name__ == '__main__':
    handler = RotatingFileHandler('hungry.log', maxBytes=10000, backupCount=1)
    handler.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    SocketIOServer(('', app.config['PORT']), app, resource="socket.io").serve_forever()
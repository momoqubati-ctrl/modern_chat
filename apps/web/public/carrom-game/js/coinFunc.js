var cdropsnd = new Audio("./assets/music/coin-drop.wav");
cdropsnd.volume = 0.02;
var sdropsnd = new Audio("./assets/music/striker-drop.wav");
sdropsnd.volume = 0.02;
var bgsnd = new Audio("./assets/music/walk.mp3");
// audio used from https://audionautix.com/free-music/acoustic
bgsnd.volume = 0.15;
bgsnd.loop = true;
var bgsndMuted = false;
var firstHit = false;
var hitBlueCoin = false;

// play tick sound
var playTick = function () {
	var aud = new Audio();
	aud.src = "./assets/music/tick.wav";
	aud.volume = 0.05;
	aud.play();
}

// player definition
function player(x, y, rightBound, leftBound) {
	this.x = x;
	this.y = y;
	this.lb = leftBound;
	this.rb = rightBound;
	this.score = 0;
	this.coins = { white: 0, black: 0 };
}

// show score on UI
function updateScore() {
	var swapped = document.body.classList.contains('player-two-view');
	for (var i = 0; i < players.length; i++) {
		var scoreIndex = swapped ? (1 - i) : i;
		var score = document.getElementById(i);
		if (score) {
			score.innerHTML = players[scoreIndex].score;
		}
	}
}

// calculates distance between two points
function dist(x1, y1, x2, y2) {
	var dis = Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2);
	dis = Math.sqrt(dis);
	return dis;
}

// returns whether all coins stopped or not
function allCoinStop() {
	for (var i = 0; i < hittingObjs.length; i++) {
		if (Math.abs(hittingObjs[i].vx) > 0 || Math.abs(hittingObjs[i].vy) > 0) {
			return false;
		}
	}
	if (hitBlueCoin) {
		if (players[currPlayer].coins.black > 0) {
			players[currPlayer].score -= 10;
			hittingObjs.push(new coin(260, 260, '#333333', 0, 0, 'black'));
			players[currPlayer].coins.black--;
		} else if (players[currPlayer].coins.white > 0) {
			players[currPlayer].score -= 20;
			hittingObjs.push(new coin(260, 260, '#f3e5ab', 0, 0, 'white'));
			players[currPlayer].coins.white--;
		}
		updateScore();
		hitBlueCoin = false;
	}
	firstHit = false;
	return true;
}

// coin hits the pot
function coinPot(coin) {
	// Synchronized with visual assets in boardSetup.js (17 + 10 = 27, 483 + 10 = 493)
	var potTopLeft = dist(coin.x, coin.y, 27, 27);
	var potTopRight = dist(coin.x, coin.y, 493, 27);
	var potBottomLeft = dist(coin.x, coin.y, 27, 493);
	var potBottomRight = dist(coin.x, coin.y, 493, 493);

	// Maximum sensitivity: 32 pixels threshold for enlarged holes.
	var threshold = 32;
	if (potTopLeft < threshold || potTopRight < threshold || potBottomLeft < threshold || potBottomRight < threshold)
		return true;
	else
		return false;
}

// coin class
function coin(x, y, color, vx, vy, name, radius) {
	this.x = x;
	this.y = y;
	this.vx = vx;
	this.vy = vy;
	this.name = name || 'coin';
	this.color = color;
	this.radius = radius ? radius : coinSize;
	this.rebound = function (dt) {
		dt = dt || 1;
		var r = this.radius;
		
		// Check if the coin is close to any pocket
		var pockets = [{x:27, y:27}, {x:493, y:27}, {x:27, y:493}, {x:493, y:493}];
		var pocketThreshold = 40; // Increased to 40 to ensure no wall bounce near pocket approach
		var nearPocket = false;
		for (var p = 0; p < pockets.length; p++) {
			if (dist(this.x, this.y, pockets[p].x, pockets[p].y) < pocketThreshold) {
				nearPocket = true;
				break;
			}
		}
		
		// If near a pocket, skip wall rebound entirely — let the coin pass freely
		if (nearPocket) return;
		
		// Check wall collisions using SUB-STEP velocity (* dt)
		if (this.x + r + this.vx * dt > 500) {
			if (Math.abs(this.vx) > 0.3) playTick();
			this.vx = -Math.abs(this.vx); // Force bounce left
		} else if (this.x - r + this.vx * dt < 20) {
			if (Math.abs(this.vx) > 0.3) playTick();
			this.vx = Math.abs(this.vx); // Force bounce right
		}
		
		if (this.y + r + this.vy * dt > 500) {
			if (Math.abs(this.vy) > 0.3) playTick();
			this.vy = -Math.abs(this.vy); // Force bounce up
		} else if (this.y - r + this.vy * dt < 20) {
			if (Math.abs(this.vy) > 0.3) playTick();
			this.vy = Math.abs(this.vy); // Force bounce down
		}
	}
	this.update = function (dt) {
		dt = dt || 1;
		this.x += this.vx * dt;
		this.y += this.vy * dt;

		// Friction scaled by dt
		var friction = Math.pow(0.985, dt);
		this.vx *= friction;
		this.vy *= friction;
	}
	this.crash = function (i, j, dt) {
		dt = dt || 1;
		var obj1 = hittingObjs[j];
		var obj2 = hittingObjs[i];

		// Check collision at the end of the sub-step
		var nextX1 = obj1.x + obj1.vx * dt;
		var nextY1 = obj1.y + obj1.vy * dt;
		var nextX2 = obj2.x + obj2.vx * dt;
		var nextY2 = obj2.y + obj2.vy * dt;

		var collisionDist = obj1.radius + obj2.radius;
		var dis = dist(nextX1, nextY1, nextX2, nextY2);
		if (dis <= collisionDist) {
			// Collision detected
			var dx = obj1.x - obj2.x;
			var dy = obj1.y - obj2.y;

			// Prevent division by zero
			if (dx === 0 && dy === 0) return;

			var collisionAngle = Math.atan2(dy, dx);

			// Relative velocity
			var relVx = obj1.vx - obj2.vx;
			var relVy = obj1.vy - obj2.vy;

			// Only collide if moving towards each other
			var dotProduct = dx * relVx + dy * relVy;
			if (dotProduct > 0) return;

			var speed1 = Math.sqrt(obj2.vx * obj2.vx + obj2.vy * obj2.vy);
			var speed2 = Math.sqrt(obj1.vx * obj1.vx + obj1.vy * obj1.vy);

			var direction1 = Math.atan2(obj2.vy, obj2.vx);
			var direction2 = Math.atan2(obj1.vy, obj1.vx);

			var velocityx_1 = speed1 * Math.cos(direction1 - collisionAngle);
			var velocityy_1 = speed1 * Math.sin(direction1 - collisionAngle);
			var velocityx_2 = speed2 * Math.cos(direction2 - collisionAngle);
			var velocityy_2 = speed2 * Math.sin(direction2 - collisionAngle);

			var final_velocityx_1 = velocityx_2;
			var final_velocityx_2 = velocityx_1;
			var final_velocityy_1 = velocityy_1;
			var final_velocityy_2 = velocityy_2;

			obj2.vx = Math.cos(collisionAngle) * final_velocityx_1 + Math.cos(collisionAngle + Math.PI / 2) * final_velocityy_1;
			obj2.vy = Math.sin(collisionAngle) * final_velocityx_1 + Math.sin(collisionAngle + Math.PI / 2) * final_velocityy_1;
			obj1.vx = Math.cos(collisionAngle) * final_velocityx_2 + Math.cos(collisionAngle + Math.PI / 2) * final_velocityy_2;
			obj1.vy = Math.sin(collisionAngle) * final_velocityx_2 + Math.sin(collisionAngle + Math.PI / 2) * final_velocityy_2;

			if (obj1.vx > 0.3 || obj1.vy > 0.3 || obj2.vx > 0.3 || obj2.vy > 0.3) {
				playTick();
			}
		}
	}
}

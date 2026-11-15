// Global coin size — must be defined before boardSetup.js uses it
var coinSize = 10;

// Pocket positions (must match coinFunc.js coinPot)
var pocketPositions = [{x:27, y:27}, {x:493, y:27}, {x:27, y:493}, {x:493, y:493}];

// Global function to draw all 4 pockets — called every frame
function drawPockets(ctx) {
    for (var i = 0; i < pocketPositions.length; i++) {
        var px = pocketPositions[i].x;
        var py = pocketPositions[i].y;
        
        // Outer gold ring
        ctx.beginPath();
        ctx.arc(px, py, 24, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        
        // Inner dark hole (solid circle, no outlines)
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#1a0505';
        ctx.fill();
        
        // Deep black center
        ctx.beginPath();
        ctx.arc(px, py, 16, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#000000';
        ctx.fill();
    }
}

// drawing circles
function drawCircle(x, y, r, color, ctx) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r - 6, 0, 2 * Math.PI, false);
    ctx.stroke();
}

// drawing striker
function drawSCircle(x, y, r, color, ctx) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r - 9, 0, 2 * Math.PI, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r - 3, 0, 2 * Math.PI, false);
    ctx.strokeStyle = '#0091ff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r - 6, 0, 2 * Math.PI, false);
    ctx.strokeStyle = '#bb00ff';
    ctx.stroke();
}

// drawing board red circles
function drawDCircle(x, y, r, color, ctx) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    ctx.lineWidth = 2;
    ctx.stroke();
    var grd = ctx.createRadialGradient(x, y, 5, x, y, 10);
    grd.addColorStop(0, "red");
    grd.addColorStop(1, color);
    ctx.fillStyle = grd;
    ctx.fill();
}

// black circles
function drawCircleS(x, y, r, ctx) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    ctx.stroke();

}

// main board outline
function drawRect(x, y, width, height, color, ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

// draw the arcs on board
function drawArc(x, y, r, angle_st, angle_end, ctx) {
    ctx.beginPath();
    ctx.arc(x, y, r, angle_st, angle_end, false);
    ctx.stroke();
}

// draw light lines on board
function drawLine(x1, y1, x2, y2, colorL, ctx) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = colorL;
    ctx.stroke();
}

// draw board dark lines
function drawLineDark(x1, y1, x2, y2, colorL, ctx) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = colorL;
    ctx.stroke();
}

// draw aiming arrow
function drawAimArrow(ctx, fromX, fromY, toX, toY) {
    var headlen = 15; // length of head in pixels
    var dx = toX - fromX;
    var dy = toY - fromY;
    var angle = Math.atan2(dy, dx);
    
    // Create gradient
    var grad = ctx.createLinearGradient(fromX, fromY, toX, toY);
    grad.addColorStop(0, "yellow");
    grad.addColorStop(1, "red");

    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(toX, toY);
    ctx.fillStyle = "red";
    ctx.fill();
    
    ctx.lineWidth = 1; // reset
}

// draw predictive trajectory with bounces
function drawPredictivePath(ctx, startX, startY, angle, power) {
    var currentX = startX;
    var currentY = startY;
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    var totalLen = Math.min(power * 4, 400); // Shorter prediction for less complexity
    var remainingLen = totalLen;
    
    ctx.save();
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    
    // Reduced bounces for simplicity
    for (var bounce = 0; bounce < 2; bounce++) {
        var minDist = remainingLen;
        var hitWall = null;
        var hitCoin = null;
        
        // Wall check
        if (dx < 0) {
            var d = (currentX - 31) / -dx;
            if (d > 0 && d < minDist) { minDist = d; hitWall = 'x'; }
        } else if (dx > 0) {
            var d = (489 - currentX) / dx;
            if (d > 0 && d < minDist) { minDist = d; hitWall = 'x'; }
        }
        
        if (dy < 0) {
            var d = (currentY - 31) / -dy;
            if (d > 0 && d < minDist) { minDist = d; hitWall = 'y'; }
        } else if (dy > 0) {
            var d = (489 - currentY) / dy;
            if (d > 0 && d < minDist) { minDist = d; hitWall = 'y'; }
        }
        
        // Coin check (hittingObjs is global)
        if (typeof hittingObjs !== 'undefined') {
            for (var i = 1; i < hittingObjs.length; i++) {
                var coin = hittingObjs[i];
                var t = getRayCircleIntersection(currentX, currentY, dx, dy, coin.x, coin.y, 20); // sum of radii
                if (t !== null && t < minDist) {
                    minDist = t;
                    hitCoin = coin;
                    hitWall = null; // Coin hit takes priority over wall if closer
                }
            }
        }
        
        currentX += dx * minDist;
        currentY += dy * minDist;
        ctx.lineTo(currentX, currentY);
        
        remainingLen -= minDist;
        if (remainingLen <= 0 || (!hitWall && !hitCoin)) break;
        
        if (hitWall === 'x') {
            dx = -dx;
        } else if (hitWall === 'y') {
            dy = -dy;
        } else if (hitCoin) {
            // 1. Draw the HIT COIN's predicted path (Green)
            ctx.save();
            ctx.setLineDash([6, 4]); // Larger dashes
            ctx.strokeStyle = "rgba(0, 255, 0, 0.7)"; 
            ctx.lineWidth = 2; 
            ctx.beginPath();
            ctx.moveTo(hitCoin.x, hitCoin.y);
            
            // Direction from striker to coin center
            var cDx = hitCoin.x - currentX;
            var cDy = hitCoin.y - currentY;
            var mag = Math.sqrt(cDx * cDx + cDy * cDy);
            cDx /= mag; cDy /= mag;
            
            // Project coin path (Shorter)
            ctx.lineTo(hitCoin.x + cDx * 100, hitCoin.y + cDy * 100);
            ctx.stroke();
            ctx.restore();

            // 2. Calculate the STRIKER's path after hit (Tangential movement)
            // In a real collision of equal masses, the striker loses its normal component
            var nx = (currentX - hitCoin.x) / 20;
            var ny = (currentY - hitCoin.y) / 20;
            var dot = dx * nx + dy * ny;
            
            // The striker continues with its tangential velocity only
            dx = dx - dot * nx; 
            dy = dy - dot * ny;
            
            // Draw impact point
            ctx.save();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
            ctx.fillStyle = "red"; // Changed from white to red
            ctx.fill();
            ctx.restore();
            ctx.moveTo(currentX, currentY);
        }
    }
    
    ctx.strokeStyle = "rgba(255, 0, 0, 0.6)"; // Changed from white to red
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

function getRayCircleIntersection(startX, startY, dx, dy, cx, cy, r) {
    var fx = startX - cx;
    var fy = startY - cy;
    var a = dx * dx + dy * dy;
    var b = 2 * (fx * dx + fy * dy);
    var c = (fx * fx + fy * fy) - r * r;
    var discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    discriminant = Math.sqrt(discriminant);
    var t1 = (-b - discriminant) / (2 * a);
    if (t1 >= 0.1) return t1; // Reduced offset for higher precision near contact
    return null;
}

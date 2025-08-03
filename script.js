const margin = {top: 40, right: 60, bottom: 50, left: 60};
const width = 960 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

let currentScene = 1;
const totalScenes = 4;

const canvas = d3.select("#vis-canvas").attr("width", 960).attr("height", 500);
const context = canvas.node().getContext("2d");
context.translate(margin.left, margin.top);

const svg = d3.select("#vis-svg").attr("width", 960).attr("height", 500);
const axisGroup = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const annotation = d3.select("#annotation p");
const tooltip = d3.select("#tooltip");

function linearRegression(data, xAccessor, yAccessor) {
    let n = 0; let sum_x = 0; let sum_y = 0; let sum_xy = 0; let sum_xx = 0; let sum_yy = 0;
    data.forEach(d => {
        const x = xAccessor(d); const y = yAccessor(d);
        if (y != null && isFinite(x) && isFinite(y)) {
            n++; sum_x += x; sum_y += y; sum_xy += x * y; sum_xx += x * x; sum_yy += y * y;
        }
    });
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
    const slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
    const intercept = (sum_y - slope * sum_x) / n;
    const r2Denom = (n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y);
    const r2 = r2Denom === 0 ? 1 : Math.pow((n * sum_xy - sum_x * sum_y), 2) / r2Denom;
    return { slope, intercept, r2 };
}


function updateActiveState(sceneId, data) {
    currentScene = sceneId;
    d3.selectAll("#controls button").classed("active", false);
    d3.select(`#scene${currentScene}`).classed("active", true);
    drawScene(currentScene, data);
}

Promise.all([
    d3.csv("full_vehicle_data.csv", d3.autoType),
    d3.csv("guzzler_trends.csv", d3.autoType),
    d3.csv("cylinder_trends.csv", d3.autoType),
    d3.csv("co2_trends.csv", d3.autoType)
]).then(([vehicleData, guzzlerTrends, cylinderTrends, co2Trends]) => {
    const allData = { vehicleData, guzzlerTrends, cylinderTrends, co2Trends };

    updateActiveState(currentScene, allData);

    d3.selectAll("#controls button").on("click", function() {
        const sceneId = parseInt(d3.select(this).attr("id").replace("scene", ""));
        updateActiveState(sceneId, allData);
    });

    d3.select("#next-scene").on("click", function() {
        currentScene = currentScene % totalScenes + 1;
        updateActiveState(currentScene, allData);
    });

    d3.select("#prev-scene").on("click", function() {
        currentScene = currentScene === 1 ? totalScenes : currentScene - 1;
        updateActiveState(currentScene, allData);
    });

});

function drawScene(sceneId, data) {
    context.clearRect(-margin.left, -margin.top, 960, 500);
    axisGroup.selectAll("*").remove();
    svg.selectAll(".overlay").remove();
    tooltip.style("visibility", "hidden");
    annotation.html("");

    switch (sceneId) {
        case 1: drawScene1(data.vehicleData); break;
        case 2: drawScene2(data.cylinderTrends); break;
        case 3: drawScene3(data.co2Trends); break;
        case 4: drawScene4(data.guzzlerTrends); break;
    }
}


function drawScene1(data) {
    annotation.html("<b>MPG (Miles Per Gallon) Distribution by Year.</b><p>According to the data from the EPA, fuel economy for gasoline-powered internal-combustion-engine (\"gas ICE\") vehicles has improved over the past ~40 years.</p><p><i>Mouse over data in each year to see detailed numbers for Vehicle MPG for that model year of testing!</i></p><p>This box plot shows you EPA Combined MPG data for gas ICE vehicles by year. The middle 50% of vehicles had combined MPG ratings within the blue boxes (for each model year) (i.e. the IQR or interquartile range). The white line in the blue box represents the median Combined MPG rating for the 50th percentile of gas ICE vehicles--that is to say, ~50% of the tested gas ICE vehicles for that model year had a higher rating, and ~50% had a lower one.</p>");

    const yearRange = d3.extent(data, d => d.year);
    const x = d3.scaleBand().domain(d3.range(yearRange[0], yearRange[1] + 1)).range([0, width]).padding(0.6);
    const y = d3.scaleLinear().domain(d3.extent(data, d => d.combMPG)).nice().range([height, 0]);

    axisGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues(x.domain().filter(d => d % 5 === 0)));
    axisGroup.append("g").call(d3.axisLeft(y));

    const dataByYear = d3.group(data, d => d.year);

    dataByYear.forEach((values, year) => {
        if (!x(year)) return;
        const mpgs = values.map(d => d.combMPG).filter(mpg => mpg != null).sort(d3.ascending);
        if (mpgs.length === 0) return;

        const q1 = d3.quantile(mpgs, 0.25);
        const median = d3.quantile(mpgs, 0.5);
        const q3 = d3.quantile(mpgs, 0.75);
        if (median === undefined) return;

        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;
        const outliers = mpgs.filter(d => d < lowerFence || d > upperFence);
        const nonOutliers = mpgs.filter(d => d >= lowerFence && d <= upperFence);

        const centerX = x(year) + x.bandwidth() / 2;

        context.fillStyle = "rgba(108, 117, 125, 0.5)";
        outliers.forEach(d => {
            context.beginPath(); context.arc(centerX, y(d), 2, 0, 2 * Math.PI); context.fill();
        });

        const whiskerMin = nonOutliers[0];
        const whiskerMax = nonOutliers[nonOutliers.length - 1];
        context.beginPath();
        context.moveTo(centerX, y(whiskerMin)); context.lineTo(centerX, y(whiskerMax));
        context.moveTo(centerX - x.bandwidth()/2, y(whiskerMin)); context.lineTo(centerX + x.bandwidth()/2, y(whiskerMin));
        context.moveTo(centerX - x.bandwidth()/2, y(whiskerMax)); context.lineTo(centerX + x.bandwidth()/2, y(whiskerMax));
        context.strokeStyle = "#343a40"; context.lineWidth = 1.5; context.stroke();

        context.beginPath();
        context.rect(x(year), y(q3), x.bandwidth(), y(q1) - y(q3));
        context.fillStyle = "rgba(31, 119, 180, 0.7)"; context.fill();
        context.strokeStyle = "rgba(31, 119, 180, 1)"; context.stroke();

        context.beginPath();
        context.moveTo(x(year), y(median)); context.lineTo(x(year) + x.bandwidth(), y(median));
        context.strokeStyle = "#fff"; context.lineWidth = 2; context.stroke();
    });

    const overlay = axisGroup.append("g").attr("class", "overlay");
    overlay.selectAll("rect").data(Array.from(dataByYear.entries())).join("rect")
        .attr("x", d => x(d[0])).attr("y", 0).attr("width", x.bandwidth()).attr("height", height).style("fill", "transparent")
        .on("mouseover", function(event, [year, values]) {
            const mpgs = values.map(d => d.combMPG).filter(mpg => mpg != null).sort(d3.ascending);
            if (mpgs.length === 0) return;
            const q1 = d3.quantile(mpgs, 0.25), median = d3.quantile(mpgs, 0.5), q3 = d3.quantile(mpgs, 0.75);
            if (median === undefined) return;
            tooltip.style("visibility", "visible").html(`<b>Year: ${year}</b><br>Median: ${median.toFixed(1)} MPG<br>IQR: ${(q3-q1).toFixed(1)}<br>Range: ${q1.toFixed(1)}–${q3.toFixed(1)}`);
        })
        .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"))
        .on("mouseout", () => tooltip.style("visibility", "hidden"));
}

function drawScene2(data) {
    annotation.html("<b>Combined MPG (Miles Per Gallon) Trend by Cylinder Class.</b><p><p>According to the data from the EPA, fuel economy for the top 3 classes of gasoline-powered internal-combustion-engine (\"gas ICE\") vehicles (4-Cylinder, 6-Cylinder, and 8-Cylinder) has improved over the past ~40 years.</p><p><i>Mouse over data in each year to see detailed numbers for Vehicle MPG for that model year of testing!</i></p><p>Although 4-Cylinder vehicles have remained the most efficient overall of the 3 classes, 6- and 8- Cylinder vehicles have also shown efficiency improvements.</p><p>Below are the correlation of coefficient constants showing that the overall improvement in MPG has been linear.</p>");
    const yMax = d3.max(data, d => d.avg_mpg_4cyl);
    const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([height, 0]);

    axisGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    axisGroup.append("g").call(d3.axisLeft(y));

    const lineClasses = [
        { name: "Overall", key: "avg_comb_mpg_overall", color: "#343a40" },
        { name: "4-Cylinder", key: "avg_mpg_4cyl", color: "#2ca02c" },
        { name: "6-Cylinder", key: "avg_mpg_6cyl", color: "#ff7f0e" },
        { name: "8-Cylinder", key: "avg_mpg_8cyl", color: "#d62728" }
    ];

    lineClasses.forEach(lineInfo => {
        const lineData = data.filter(d => isFinite(d[lineInfo.key]));
        const line = d3.line().x(d => x(d.year)).y(d => y(d[lineInfo.key])).context(context);
        context.beginPath(); line(lineData); context.strokeStyle = lineInfo.color; context.lineWidth = 2.5; context.stroke();

        const { slope, intercept, r2 } = linearRegression(lineData, d => d.year, d => d[lineInfo.key]);
        const [x1, x2] = x.domain();
        context.beginPath(); context.moveTo(x(x1), y(slope * x1 + intercept)); context.lineTo(x(x2), y(slope * x2 + intercept));
        context.strokeStyle = lineInfo.color; context.globalAlpha = 0.6; context.setLineDash([3, 3]); context.lineWidth = 1.5; context.stroke();
        context.globalAlpha = 1.0; context.setLineDash([]);

        annotation.append("p").style("display","inline-block").style("margin","0 10px").html(`<span style="color:${lineInfo.color}">■</span> ${lineInfo.name} (R² = ${r2.toFixed(3)})`);
    });

    const bisector = d3.bisector(d => d.year).left;
    axisGroup.append("rect").attr("class", "overlay").attr("width", width).attr("height", height).style("fill", "transparent")
        .on("mouseover", () => tooltip.style("visibility", "visible")).on("mouseout", () => tooltip.style("visibility", "hidden"))
        .on("mousemove", function(event) {
            const x0 = x.invert(d3.pointer(event, this)[0]);
            const i = bisector(data, x0, 1);
            if (i <= 0 || i >= data.length) return;
            const d = (x0 - data[i - 1].year > data[i].year - x0) ? data[i] : data[i - 1];

            let tooltipHtml = `<b>Year: ${d.year}</b>`;
            lineClasses.forEach(lineInfo => {
                if(isFinite(d[lineInfo.key])) {
                    tooltipHtml += `<br><span style="color:${lineInfo.color}">■</span> ${lineInfo.name}: ${d[lineInfo.key].toFixed(1)} MPG`;
                }
            });
            tooltip.html(tooltipHtml).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        });
}

function drawScene4(data) {
    annotation.html("<b>Gas Guzzler Trends.</b><p>Cars that don't meet fuel economy standards in the US are <a href='https://en.wikipedia.org/wiki/Energy_Tax_Act'>penalized by taxing the manufacturer or importer</a>. The share of cars defined as \"Gas Guzzlers\" relative to EPA tested vehicles per model year has always remained less than 10%. The data shows that the periods which saw the most gas guzzlers were the early 1990s and the mid 2000s.</p><i>Mouse over data in each year to see detailed numbers for Gas Guzzlers for that model year of testing!</i><p>The red and blue bars show Year-over-Year change in Guzzlers, while the black line shows the absolute percentage. Please note the different y-scales for each.</p>");

    const yoyData = data.filter(d => isFinite(d.yoy_change));
    const yoyMax = d3.max(yoyData, d => Math.abs(d.yoy_change));
    const x = d3.scaleBand().domain(yoyData.map(d => d.year)).range([0, width]).padding(0.3);
    const yYoY = d3.scaleLinear().domain([-yoyMax, yoyMax]).nice().range([height, 0]);
    const yPercent = d3.scaleLinear().domain([0, 15]).range([height, 0]);

    const leftAxis = axisGroup.append("g").call(d3.axisLeft(yYoY));
    const leftLabel = leftAxis.append("text").attr("x", 0).attr("y", -20).attr("text-anchor", "start").attr("fill", "#000");
    leftLabel.append("tspan").text("YoY Change (pts) ");
    leftLabel.append("tspan").attr("font-family", "monospace").text("[");
    leftLabel.append("tspan").attr("fill", "#d62728").text("■");
    leftLabel.append("tspan").attr("fill", "#1f77b4").text("■");
    leftLabel.append("tspan").text("]");

    const rightAxis = axisGroup.append("g").attr("transform", `translate(${width}, 0)`).call(d3.axisRight(yPercent));
    const rightLabel = rightAxis.append("text").attr("x", 0).attr("y", -20).attr("text-anchor", "end").attr("fill", "#000").text("Absolute Guzzler (%) [");
    rightAxis.append("image").attr("href", "line.png").attr("x", -3).attr("y", -30).attr("width", 48).attr("height", 16);
    const rightLabelEnd = rightAxis.append("text").attr("x", 42).attr("y", -20).attr("text-anchor", "end").attr("fill", "#000").text("]");

    rightAxis.append("tspan").text("font-family", "monospace").text("[");

    axisGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues(x.domain().filter(d => d % 5 === 0)));
    axisGroup.append("line").attr("x1", 0).attr("x2", width).attr("y1", yYoY(0)).attr("y2", yYoY(0)).attr("stroke", "#343a40");

    yoyData.forEach(d => {
        context.fillStyle = d.yoy_change >= 0 ? 'rgba(214, 39, 40, 0.7)' : 'rgba(31, 119, 180, 0.7)';
        context.fillRect(x(d.year), d.yoy_change >= 0 ? yYoY(d.yoy_change) : yYoY(0), x.bandwidth(), Math.abs(yYoY(0) - yYoY(d.yoy_change)));
    });
    const absLine = d3.line().x(d => x(d.year) + x.bandwidth() / 2).y(d => yPercent(d.guzzler_percentage)).context(context);
    context.beginPath(); absLine(data.filter(d=>d.year >= x.domain()[0])); context.strokeStyle = '#000'; context.lineWidth = 2.5; context.stroke();

    axisGroup.append("g").attr("class", "overlay").selectAll("rect").data(data).join("rect")
        .attr("x", d => x(d.year)).attr("y", 0).attr("width", x.bandwidth()).attr("height", height).style("fill", "transparent")
        .on("mouseover", function(event, d) {
            const changeText = isFinite(d.yoy_change) ? `Change: ${d.yoy_change.toFixed(2)} pts` : "Change: N/A";
            tooltip.style("visibility", "visible").html(`<b>Year: ${d.year}</b><br>Guzzler Pct: ${d.guzzler_percentage.toFixed(1)}%<br>${changeText}`);
        })
        .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"))
        .on("mouseout", () => tooltip.style("visibility", "hidden"));
}


function drawScene3(data) {
    annotation.html("<b>CO₂ (Carbon Dioxide) Emissions Trend by Cylinder Class.</b><p>The EPA also tests CO₂ (Carbon Dioxide) tailpipe emissions. Along with improvements in MPG efficiency, CO₂ tailpipe emissions have also improved in the past 40 years. Features like engine start-stop and automatic cylinder shutoff have contributed to this improvement.</p><i>Mouse over data in each year to see detailed numbers for CO₂ (Carbon Dioxide) tailpipe emissions for that model year of testing!</i><p>Of the top 3 classes of gasoline-powered internal-combustion-engine (\"gas ICE\") vehicles (4-Cylinder, 6-Cylinder, and 8-Cylinder), 8-Cylinder engines showed the greatest improvement in CO₂ emissions in the last 40 years.</p><p>Below are the correlation of coefficient constants showing that the overall improvement in CO₂ Emissions has been linear.</p>");

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([300, 700]).range([height, 0]);

    axisGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    axisGroup.append("g").call(d3.axisLeft(y));

    const lineClasses = [
        { name: "Overall", key: "avg_co2_gpm_overall", color: "#343a40" },
        { name: "4-Cylinder", key: "avg_co2_4cyl", color: "#2ca02c" },
        { name: "6-Cylinder", key: "avg_co2_6cyl", color: "#ff7f0e" },
        { name: "8-Cylinder", key: "avg_co2_8cyl", color: "#d62728" }
    ];

    lineClasses.forEach(lineInfo => {
        const lineData = data.filter(d => isFinite(d[lineInfo.key]));
        const line = d3.line().x(d => x(d.year)).y(d => y(d[lineInfo.key])).context(context);
        context.beginPath(); line(lineData); context.strokeStyle = lineInfo.color; context.lineWidth = 2.5; context.stroke();

        const { slope, intercept, r2 } = linearRegression(lineData, d => d.year, d => d[lineInfo.key]);
        const [x1, x2] = x.domain();
        context.beginPath(); context.moveTo(x(x1), y(slope * x1 + intercept)); context.lineTo(x(x2), y(slope * x2 + intercept));
        context.strokeStyle = lineInfo.color; context.globalAlpha = 0.6; context.setLineDash([3, 3]); context.lineWidth = 1.5; context.stroke();
        context.globalAlpha = 1.0; context.setLineDash([]);

        annotation.append("p").style("display","inline-block").style("margin","0 10px").html(`<span style="color:${lineInfo.color}">■</span> ${lineInfo.name} (R² = ${r2.toFixed(3)})`);
    });

    const bisector = d3.bisector(d => d.year).left;
    axisGroup.append("rect").attr("class", "overlay").attr("width", width).attr("height", height).style("fill", "transparent")
        .on("mouseover", () => tooltip.style("visibility", "visible")).on("mouseout", () => tooltip.style("visibility", "hidden"))
        .on("mousemove", function(event) {
            const x0 = x.invert(d3.pointer(event, this)[0]);
            const i = bisector(data, x0, 1);
            if (i <= 0 || i >= data.length) return;
            const d = (x0 - data[i - 1].year > data[i].year - x0) ? data[i] : data[i - 1];

            let tooltipHtml = `<b>Year: ${d.year}</b>`;
            lineClasses.forEach(lineInfo => {
                if(isFinite(d[lineInfo.key])) {
                    tooltipHtml += `<br><span style="color:${lineInfo.color}">■</span> ${lineInfo.name}: ${d[lineInfo.key].toFixed(0)} g/mi`;
                }
            });
            tooltip.html(tooltipHtml).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        });
}
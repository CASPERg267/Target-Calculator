const monthsContainer = document.getElementById("months");
const inputs = [];
let month4Label = "";

// this baby gives us a new month by skipping forward. Doctor Who but make it Date()
function getNextMonth(date, offset) {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + offset);
  return newDate;
}

// count the workdays... because capitalism
function getWorkingDays(year, month, daysOff) {
  let workingDays = 0; // 0, hopefully xD
  const date = new Date(year, month, 1);

  while (date.getMonth() === month) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) workingDays++; // skip sat (6) & sun (0)
    date.setDate(date.getDate() + 1);
  }

  // subtract those sweet, sweet days off
  if (daysOff === 1) workingDays -= 1;
  else if (daysOff === 2) workingDays -= 1.5;
  else if (daysOff > 2) workingDays -= 1.5 + (daysOff - 2);

  return Math.max(0, Math.floor(workingDays));
}

// build the sacred monthly input fields
function generateMonthSections() {
  const previousValues = inputs.map(input => ({
    trans: input.trans?.value || "",
    off: input.off?.value || ""
  }));

  monthsContainer.innerHTML = "";
  inputs.length = 0;

  const start = document.getElementById("startMonth").value;
  if (!start) return;

  const startDate = new Date(start);
  month4Label = getNextMonth(startDate, 3).toLocaleString('default', { month: 'long', year: 'numeric' });

  for (let i = 0; i < 3; i++) {
    const current = getNextMonth(startDate, i);
    const label = current.toLocaleString('default', { month: 'long', year: 'numeric' });

    const monthDiv = document.createElement("div");
    monthDiv.className = "month-section";

    const heading = document.createElement("h4");
    heading.innerText = label;

    const trans = document.createElement("input");
    trans.placeholder = "Total Transactions";
    trans.type = "number";
    trans.value = previousValues[i]?.trans || "";
    trans.oninput = () => {
      updateTooltip(monthDiv, current, trans, off); // should i really pass the trans input here? yes, because we need to update the tooltip with the current transaction value
      calculateTarget();
    };

    const off = document.createElement("input");
    off.placeholder = "Days Off";
    off.type = "number";
    off.value = previousValues[i]?.off || "";
    off.oninput = () => {
      updateTooltip(monthDiv, current, trans, off);
      calculateTarget();
    };

    inputs.push({ label, trans, off, date: current });

    monthDiv.appendChild(heading);
    monthDiv.appendChild(trans);
    monthDiv.appendChild(off);

    const workingDays = getWorkingDays(current.getFullYear(), current.getMonth(), parseInt(off.value) || 0);
    const totalDays = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    let weekends = 0;
    for (let d = 1; d <= totalDays; d++) {
      const day = new Date(current.getFullYear(), current.getMonth(), d).getDay();
      if (day === 0 || day === 6) weekends++;
    }

    const tooltip = document.createElement("div");
    tooltip.style.fontSize = "0.9em";
    tooltip.style.color = "#555";
    tooltip.style.marginTop = "8px";
    tooltip.innerHTML = `<strong>Working Days:</strong> ${workingDays.toFixed(1)}<br><strong>Weekends:</strong> ${weekends}`;
    monthDiv.appendChild(tooltip);

    monthsContainer.appendChild(monthDiv);
  }

  calculateTarget();
}

// time to unleash the spreadsheet demons and do math (the most tough part)
function calculateTarget() {
  if (inputs.length < 3) return;

  // here's my poor logic to do it

  const avgs = [];
  const labels = [];

  for (const month of inputs) {
    const total = parseFloat(month.trans.value);
    const off = parseInt(month.off.value);
    const date = month.date;
    const label = month.label;

    if (isNaN(total) || isNaN(off)) {
      document.getElementById("result").innerHTML = "Please complete all fields.";
      return;
    }

    const workingDays = getWorkingDays(date.getFullYear(), date.getMonth(), off);
    const avg = total / workingDays;

    avgs.push(avg);
    labels.push(label);
  }

  const finalAvg = (avgs.reduce((a, b) => a + b, 0)) / 3;
  const month4Date = inputs[0].date;
  const month4WorkingDays = getWorkingDays(month4Date.getFullYear(), month4Date.getMonth() + 3, 0);
  const month4Total = Math.round(finalAvg * month4WorkingDays);

  const now = new Date();
  const formattedDate = now.toLocaleString('default', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  document.getElementById("result").innerHTML = `
    <strong>Daily Target:</strong> ${finalAvg.toFixed(2)}<br>
    <strong>${month4Label} Target:</strong> ${month4Total}<br>
    <strong>${month4Label} Working Days:</strong> ${month4WorkingDays}<br>
    <strong>${month4Label} Weekends:</strong> ${getWeekends(month4Date.getFullYear(), month4Date.getMonth() + 3)}<br>
    <em>Calculated on: ${formattedDate}</em>
  `;

  updateChart(labels, avgs, finalAvg, inputs);
}

// here's the chart sorcery: bar chart to flex those numbers visually
function updateChart(labels, avgs, finalAvg, inputs) {
  const ctx = document.getElementById("chart").getContext("2d");
  if (window.chartInstance) window.chartInstance.destroy();

  const totals = inputs.map(input => parseFloat(input.trans.value));
  totals.push(Math.round(finalAvg * getWorkingDays(inputs[0].date.getFullYear(), inputs[0].date.getMonth() + 3, 0)));

  const updatedLabels = labels.map((label, index) => {
    if (index === 0) return label;
    const prev = avgs[index - 1];
    const curr = avgs[index];
    if (isNaN(prev) || prev === 0) return label;
    const change = ((curr - prev) / prev) * 100;
    return `${label} (${change.toFixed(1)}%)`;
  });

  updatedLabels.push(month4Label);

  window.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: updatedLabels,
      datasets: [
        {
          label: 'Daily Avg',
          data: [...avgs, finalAvg],
          backgroundColor: [...Array(3).fill('#4CAF50'), '#2196F3']
        },
        {
          label: 'Total Transactions',
          data: totals,
          backgroundColor: 'transparent'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const monthIndex = context.dataIndex;
              const total = context.chart.data.datasets[1].data[monthIndex];
              return `Avg: ${context.raw.toFixed(2)} | Total: ${total}`;
            }
          }
        },
        legend: {
          display: true
        },
        title: {
          display: true,
          text: 'Daily Average Comparison (Including Forecast)'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Average Transactions per Working Day'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Month'
          }
        }
      }
    }
  });
}

// need to remind ourselves how many weekends we didn't cry over work
function getWeekends(year, month) {
  let weekends = 0;
  const totalDays = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    const day = new Date(year, month, d).getDay();
    if (day === 0 || day === 6) weekends++;
  }
  return weekends;
}

// tooltip updater for those who enjoy overanalyzing calendars
function updateTooltip(container, dateObj, transInput, offInput) {
  const existingTooltip = container.querySelector('.tooltip');
  if (existingTooltip) existingTooltip.remove();

  const daysOff = parseInt(offInput.value) || 0;
  const workingDays = getWorkingDays(dateObj.getFullYear(), dateObj.getMonth(), daysOff);
  const totalDays = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();

  let weekends = 0;
  for (let d = 1; d <= totalDays; d++) {
    const day = new Date(dateObj.getFullYear(), dateObj.getMonth(), d).getDay();
    if (day === 0 || day === 6) weekends++;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.style.fontSize = "0.9em";
  tooltip.style.color = "#555";
  tooltip.style.marginTop = "8px";
  tooltip.innerHTML = `<strong>Working Days:</strong> ${workingDays}<br><strong>Weekends:</strong> ${weekends}`;
  container.appendChild(tooltip);
}

// for all the night people out there like me
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
}

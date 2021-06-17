/**
 * Create a WaveSurfer instance.
 */
var wavesurfer; // eslint-disable-line no-var

/**
 * Init & load.
 */
document.addEventListener('DOMContentLoaded', function () {

    //excel to JSON
    var excel;
    var audio;
    var audioPath;
    document.getElementById("startBtn").onclick = function (e) {
        e.preventDefault();
        excel = document.getElementById("excelFile").files[0];
        audio = document.getElementById("audioFile").files[0];
        audioPath = URL.createObjectURL(audio);
        initWave();
    }


    let data = [{}]

    function getExcelFile() {
        XLSX.utils.json_to_sheet(data, 'out.xlsx');
        if (excel) {
            let fileReader = new FileReader();
            fileReader.readAsBinaryString(excel);
            fileReader.onload = (event) => {
                let data = event.target.result;
                let workbook = XLSX.read(data, { type: "binary" });
                workbook.SheetNames.forEach(sheet => {
                    let rowObject = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheet]);
                    loadRegions(rowObject);
                    // saveRegions();
                    //   document.getElementById("jsondata").innerHTML = JSON.stringify(rowObject,undefined,4)
                });
            }
        }
    }

    function initWave() {
        // Init wavesurfer
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            height: 100,
            pixelRatio: 1,
            scrollParent: true,
            normalize: true,
            backend: 'MediaElement',
            plugins: [
                WaveSurfer.regions.create()
            ]
        });


        wavesurfer.load(audioPath);


        /* Regions */
        wavesurfer.on('ready', function () {
            wavesurfer.enableDragSelection({
                color: randomColor(0.1)
            });

            getExcelFile();
        });

        wavesurfer.on('region-click', function (region, e) {
            e.stopPropagation();
            // Play on click, loop on shift click
            e.shiftKey ? region.playLoop() : region.play();
        });
        wavesurfer.on('region-click', editAnnotation);
        // wavesurfer.on('region-updated', saveRegions);
        // wavesurfer.on('region-removed', saveRegions);
        wavesurfer.on('region-in', showNote);

        wavesurfer.on('region-play', function (region) {
            region.once('out', function () {
                wavesurfer.play(region.start);
                wavesurfer.pause();
            });
        });

        /* Toggle play/pause buttons. */
        let playButton = document.querySelector('#play');
        let pauseButton = document.querySelector('#pause');
        wavesurfer.on('play', function () {
            playButton.style.display = 'none';
            pauseButton.style.display = '';
        });
        wavesurfer.on('pause', function () {
            playButton.style.display = '';
            pauseButton.style.display = 'none';
        });


        document.querySelector('[data-action="delete-region"]').addEventListener('click', function () {
            let form = document.forms.edit;
            let regionId = form.dataset.region;
            if (regionId) {
                wavesurfer.regions.list[regionId].remove();
                form.reset();
            }
        });
    }
});

/**
 * Save annotations to localStorage.
 */
function saveRegions() {
    localStorage.regions = JSON.stringify(
        Object.keys(wavesurfer.regions.list).map(function (id) {
            let region = wavesurfer.regions.list[id];
            return {
                start: region.start,
                end: region.end,
                attributes: region.attributes,
                data: region.data
            };
        })
    );
}

/**
 * Load regions from localStorage.
 */
function loadRegions(regions) {
    regions.forEach(function (region) {
        if ((region.start || region.start == 0) && region.end && region.data) {
            region = format(region);
            wavesurfer.addRegion(region);
        }
    });

    document.getElementById("annotate").style.display = "block";
    document.getElementById("uploadForm").style.display = "none";
}

function format(region) {
    let temp = {
        "start": checkTimeFormat(region.start),
        "end": checkTimeFormat(region.end),
        "data": { "note": region.data }
    }
    temp.color = randomColor(0.1);
    return temp;
}

function convertTime(time) {
    const seconds = Math.round(time * 86400); // converting

    return seconds;
}

function checkTimeFormat(time) {
    if (typeof time == 'string' && time.indexOf(":") >= 0) {
        // if the format is HH:MM:SS or MM:SS
        return convertTimeHMS(time);
    } else if (time < 1 && time > 0) {
        // if the format is Second
        return convertTime(time);
    } else {
        return time;
    }
}

//MM:SS
function convertTimeHMS(hms) {
    //the array will be [HH,MM,SS] or [MM,SS]
    var timeArray = hms.trim().split(':'); // split it at the colons
    var seconds;
    if (timeArray.length == 2) {
        //Compute (MM*60)  + SS
        // minutes are worth 60 seconds.
        seconds = parseInt(timeArray[0]) * 60 + parseInt(timeArray[1]);
    } else {
        //if the time is HH:MM:SS add the hours to the current seconds
        //else use the current seconds
        seconds = parseInt(timeArray[0]) * 60 * 60 + parseInt(timeArray[1]) * 60 + parseInt(timeArray[2])
    }
    return seconds;
}

/**
 * Random RGBA color.
 */
function randomColor(alpha) {
    return (
        'rgba(' +
        [
            ~~(Math.random() * 255),
            ~~(Math.random() * 255),
            ~~(Math.random() * 255),
            alpha || 1
        ] +
        ')'
    );
}

/**
 * Edit annotation for a region.
 */
function editAnnotation(region) {
    let form = document.forms.edit;
    form.style.opacity = 1;
    (form.elements.start.value = Math.round(region.start * 10) / 10),
        (form.elements.end.value = Math.round(region.end * 10) / 10);
    form.elements.note.value = region.data.note || '';
    form.onsubmit = function (e) {
        e.preventDefault();
        region.update({
            start: form.elements.start.value,
            end: form.elements.end.value,
            data: {
                note: form.elements.note.value
            }
        });
        form.style.opacity = 0;
    };
    form.onreset = function () {
        form.style.opacity = 0;
        form.dataset.region = null;
    };
    form.dataset.region = region.id;
}

/**
 * Display annotation.
 */
function showNote(region) {
    if (!showNote.el) {
        showNote.el = document.querySelector('#subtitle');
    }
    showNote.el.textContent = region.data.note || '–';
}

const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
const EXCEL_EXTENSION = '.xlsx';


function reFormat(region) {
    let temp = {
        "start": region.start,
        "end": region.end,
        "data": region.data.note
    }
    return temp;

}

function downloadExcel() {
    var regions = Object.keys(wavesurfer.regions.list).map(function (id) {
        let region = wavesurfer.regions.list[id];
        return reFormat(region);
    });

    const worksheet = XLSX.utils.json_to_sheet(regions);
    const workbook = {
        Sheets: {
            'data': worksheet
        },
        SheetNames: ['data']
    };
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAsExcel(excelBuffer, "myFile");
}

function saveAsExcel(buffer, filename) {
    const data = new Blob([buffer], { type: EXCEL_TYPE })
    saveAs(data, `${filename} ${new Date().getTime()} ${EXCEL_EXTENSION}`)
}
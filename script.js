let alarmTime = null;

let audio = new Audio('https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3')

    function setAlarm(){
        const inputTime = document.getElementById("alarmTime").value
        if(inputTime){
            alarmTime = inputTime
            document.getElementById("status").innerHTML = "Alarm set for:" + alarmTime;
        }
    }


    setInterval(() =>{
    let now = new Date()
    let hours = String(now.getHours()).padStart(2,"0")
    let minutes = String(now.getMinutes()).padStart(2,"0")

    let currTime = hours + ":" + minutes 

        if(currTime === alarmTime){
            audio.play();
            document.getElementById("status").innerText = "ALARM RINGING!!"
            alarmTime = null;
        }
    },1000)
   
function timeStamp() {
  let current_time = new Date();


  let hoursIST = (current_time.getHours()<=9)? "0"+(current_time.getHours()) : current_time.getHours()
  let minutesIST = (current_time.getMinutes()<=9)? "0"+(current_time.getMinutes()) : current_time.getMinutes();
  let seconds=(current_time.getSeconds()<=9)?"0"+(current_time.getSeconds()) :current_time.getSeconds()

  let year=current_time.getFullYear()
  let month=(current_time.getMonth()<9) ? "0"+(current_time.getMonth()+1) :current_time.getMonth()+1 
  let date=(current_time.getDate()<=9) ? "0"+(current_time.getDate()) :current_time.getDate()

  return year+"-"+month+"-"+date+" "+hoursIST+":"+minutesIST+':'+seconds
  

}

console.log(timeStamp())


module.exports=timeStamp


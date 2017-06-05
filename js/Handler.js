Utils = {};
Utils.metaSpec={
	cred:{
		sid:"plugin2.AccountSID",
		authToken:"plugin2.AuthToken"
	},
	field:{
		phone:"Mobile"
	}
}
Utils.cred={
	sid:undefined,
	authToken:undefined
}
Utils.authHeadder = function(){
			return ZOHO.CRM.CONFIG.getOrgVariable(Utils.metaSpec.cred.sid)
			.then(function(data){
				Utils.cred.sid=data.Success.Content
				return Utils.metaSpec.cred.authToken
			})
			.then(ZOHO.CRM.CONFIG.getOrgVariable)
			.then(function(data){
				Utils.cred.authToken=data.Success.Content	
			})
			.then(function()
			{
				var authString = Utils.cred.sid+":"+Utils.cred.authToken;
				var encodedString = btoa(authString);
				var authHeadder = "Basic "+encodedString;
				return authHeadder;				
			});
	};
Utils.APIEndPoint="https://api.message360.com/api/v2";
Utils.API={
		GetNumber : function(){
			return Utils.authHeadder()
			.then(function(authHeadder){
				var request ={
				url : Utils.APIEndPoint + "/incomingphone/listnumber.json",
				params:{
					AccountSid:Utils.cred.sid,
					returntype:"json",
					page:"1",
					pagesize:"20",
					NumberType:"sms"

				},
				headers:{
				 	Authorization:authHeadder,
				}
			}
			return ZOHO.CRM.HTTP.get(request);
			});

		},
		SendSMS : function(fromno,toNumber,smsContent){
			 return Utils.authHeadder()
			.then(function(authHeadder){
				var request ={
				url : Utils.APIEndPoint + "/sms/sendsms.json",
				params:{
						'from':fromno,
						'to': toNumber,
						'fromcountrycode':'1',
						'tocountrycode':'+91',
						'body':encodeURI(smsContent)
				},
				headers:{
				 	'Authorization':authHeadder,
				 	'Content-Type':"application/x-www-form-urlencoded"
				}
			}
			return ZOHO.CRM.HTTP.post(request);
			});
			
		}
	};
/*
 * util methods
 */
Utils.showLoading = function(){
	$("#loadingDiv").show();
}
Utils.hideLoading = function(){
	$("#loadingDiv").hide();
}
Utils.successMsg = function(message){
	$('.successMsg').text(message);
	 $('.successMsg').slideDown(function() {
			$('.successMsg').delay(3000).slideUp();
			});
}
Utils.RenderTemplate=function(templateId , data,callBack){
	var template = $("#"+templateId).html();
	var compiledTemplate = Handlebars.compile(template);
	var widgetsDiv =$("#contentDiv");
	widgetsDiv.html(compiledTemplate(data));
	if(callBack)
	{
		callBack();
	}
};
Utils.removeRecepient = function(obj){
	var toRemove = $(obj).parents("tr")[0];
	var arrayIndexToRemove = $(toRemove)[0].id.replace("recepient_","");
	arrayIndexToRemove = parseInt(arrayIndexToRemove);
	delete Handler.contextData.recipients[arrayIndexToRemove];
	toRemove.remove();
}
Handler={
	contextData : undefined
}
Handler.CreateSMS = function(data){
	Utils.showLoading();
	Handler.contextData =  {};
	Handler.getRecords(data.Entity,data.EntityId)
	.then(function(data){
		Handler.contextData.recipients = data;
	})
	.then(Utils.API.GetNumber)
	.then(function(data){
		var response = JSON.parse(data);
		if(response.Message360.ResponseStatus === 1){
			Handler.contextData.numbers = response.Message360.Phones.Phone;
		}
	}).then(function(){
		Utils.RenderTemplate("ComposeSMS",Handler.contextData,function(){
			Utils.hideLoading();
		});
	});
}
Handler.SendSMS = function()
{
	Utils.showLoading();
	if($("#fromnums").val() && $("#message").val())
	{
		var fromNumber = $("#fromnums").val().trim();
		var smsContent = $("#message").val().trim();
		var promises=[];
		var recipients  = Handler.contextData.recipients;

		var sendingList = [];
		recipients.forEach(function(recipiant)
		{
			if(recipiant)
			{
				sendingList.push(recipiant)
				var number = recipiant[Utils.metaSpec.field.phone];
				var smsPromise = Utils.API.SendSMS(fromNumber,number,smsContent)
				.then(function(data){
					return JSON.parse(data).Message360
				});
				promises.push(smsPromise); 
			}
		});
		Handler.contextData.recipients  = sendingList;
		Promise.all(promises)
		.then(Handler.showReport);
	}
	else if(!$("#message").val()){
		alert("kindly enter a Message");
		Utils.hideLoading();
	}
	else if(!$("#fromnums").val()){
		alert("No Message360 Number was selected");
		Utils.hideLoading();
	}
	
}
Handler.showReport = function(data)
{
		console.log(Handler.contextData.recipients);
		console.log(data);

		var summaryObj = [];

		Handler.contextData.recipients.forEach(function(obj , index)
		{	
			var m360status = data[index];
			var status = undefined;
			if(m360status.ResponseStatus === 1 ){
				status = "Success"
			}
			else{
				status = m360status.Errors.Error[0].Message
			}	
			var temp = {
				Name:obj.Full_Name,
				Mobile:obj.Mobile,
				Status:status
			}
			summaryObj.push(temp);
			console.log(temp);
		});


		Utils.RenderTemplate("SMSSummary",{data:summaryObj},function(){
			Utils.hideLoading();
		})
}
Handler.closePopUp = function(toReload){
	if(toReload){
		return ZOHO.CRM.UI.PopUp.closeReload();
	}
	else{
		return ZOHO.CRM.UI.PopUp.close();	
	}
	
}

Handler.getRecords = function(entity,entityIds){
	var promises=[];
	for(i in entityIds){
		var recordPromise = ZOHO.CRM.API.getRecord({Entity:entity,RecordID:entityIds[i]})
		.then(function(data){
			return data;
		});
		promises.push(recordPromise); 
	}
	return Promise.all(promises);

}

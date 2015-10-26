require 'net/http'
require 'json'

# :first_in sets how long it takes before the job is first run. In this case, it is run immediately
SCHEDULER.every '10s', :first_in => 0 do |job|
	tokenURI = URI('https://api.netatmo.net/oauth2/token')
	tokenResponse = Net::HTTP.post_form(
		tokenURI, 
		'grant_type' => ENV['NETATMO_GRANT_TYPE'], 
		'client_id' => ENV['NETATMO_CLIENT_ID'],
		'client_secret' => ENV['NETATMO_CLIENT_SECRET'],
		'username' => ENV['NETATMO_USERNAME'],
		'password' => ENV['NETATMO_PASSWORD'],
		'scope' => 'read_station'
	)
	tokenResult = JSON.parse(tokenResponse.body)
	access_token = tokenResult['access_token']

	stationsDataURI = URI('https://api.netatmo.com/api/getstationsdata')
	stationsDataParams = { :access_token => access_token }
	stationsDataURI.query = URI.encode_www_form(stationsDataParams)
	stationsDataResponse = Net::HTTP.get_response(stationsDataURI)
	stationsData = JSON.parse(stationsDataResponse.body)
	
	insideTemperature = stationsData['body']['devices'][0]['dashboard_data']['Temperature']
	outsideTemperature = stationsData['body']['devices'][0]['modules'][0]['dashboard_data']['Temperature']

	send_event('inside_temp', { temp: insideTemperature })
	send_event('outside_temp', { temp: outsideTemperature })
end
require 'net/http'
require 'json'

# :first_in sets how long it takes before the job is first run. In this case, it is run immediately
SCHEDULER.every '10s', :first_in => 0 do |job|
	tokenURI = URI('https://api.netatmo.net/oauth2/token')
	tokenResponse = Net::HTTP.post_form(
		tokenURI, 
		'grant_type' => '****', 
		'client_id' => '****',
		'client_secret' => '****',
		'username' => '****',
		'password' => '****',
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

	send_event('inside_temp', { :temp => "#{insideTemperature}" })
end
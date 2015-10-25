require 'json'

nextTrainsJSON = '{destination: "St-Germain-en-Laye Poissy-Cergy",ligne: "a",station: "la varenne-chennevieres",horaires: [{id: "WRWN",terminus: "La Varenne-Chennevieres",horaire: "Sans voyageurs V.Z"},{id: "WRWN",terminus: "La Varenne-Chennevieres",horaire: "Sans voyageurs V.Z"},{id: "WRWN",terminus: "La Varenne-Chennevieres",horaire: "Sans voyageurs V.Z"}]}'

def getTrafficData
	trafficURI = URI('http://api-ratp.pierre-grimaud.fr/data/trafic/rer')
	trafficDataResponse = Net::HTTP.get_response(trafficURI)
	return JSON.parse(trafficDataResponse.body)
end

def getTrafficSituation(traffic)
	return traffic['trafic']
end

def getLinesInformations(traffic)
	perturbations = traffic['perturbations']
	lines = []
	if (perturbations != nil)
		perturbations.each { |perturbation|
			perturbation.each { |line, infos|
				lines << {:name => line, :infos => infos}
			}
		}
	end
	return lines
end

def getStatusIcon(traffic)
	perturbations = traffic['perturbations']
	if (perturbations != nil)
		return "icon-warning-sign"
	end
	return nil
end

def trafficJob
	traffic = getTrafficData()
	situation = getTrafficSituation(traffic)
	lines = getLinesInformations(traffic)
	status_icon = getStatusIcon(traffic)
	send_event('rer_traffic', { :situation => situation, :lines => lines, :status_icon => status_icon })
end

SCHEDULER.every '5m', :first_in => 0 do |job|
	trafficJob()
  	#send_event('rer_next_train', { :text => 'normal' })
end
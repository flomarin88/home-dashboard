require 'json'

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
	send_event('rer_traffic', { situation: situation, lines: lines, status_icon: status_icon })
end

def nextTrainsJob
	nextTrainsURI = URI('http://api-ratp.pierre-grimaud.fr/rer/a/la+varenne-chennevieres/st+germain+poissy+cergy')
	nextTrainsDataResponse = Net::HTTP.get_response(nextTrainsURI)
	nextTrains = JSON.parse(nextTrainsDataResponse.body)
	horaires = nextTrains['horaires']
	items = horaires.collect { |horaire|
		{:label => horaire['terminus'], :value => horaire['horaire']}
	}
	send_event('rer_next_train', { items: items })
end

SCHEDULER.every '2m', :first_in => 0 do |job|
	trafficJob()
	nextTrainsJob()
end
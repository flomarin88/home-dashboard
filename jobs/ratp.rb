require 'json'

nextTrainsJSON = '{destination: "St-Germain-en-Laye Poissy-Cergy",ligne: "a",station: "la varenne-chennevieres",horaires: [{id: "WRWN",terminus: "La Varenne-Chennevieres",horaire: "Sans voyageurs V.Z"},{id: "WRWN",terminus: "La Varenne-Chennevieres",horaire: "Sans voyageurs V.Z"},{id: "WRWN",terminus: "La Varenne-Chennevieres",horaire: "Sans voyageurs V.Z"}]}'

def getTrafficData
	trafficJSON = '{"trafic": "normal"}'
	#trafficJSON = '{"trafic": "perturbation","perturbations": [{"METRO 1": "Ts les jours l\'arrêt n\'est pas marqué à Louvre-Rivoli jusqu\'au 25/11/15. (travaux de rénovation)"},{"METRO 2": "Ts les jours le trafic est interrompu entre Nation et Avron jusqu\'au 27/10/15. (travaux sur la voie)"}]}'
	return JSON.parse(trafficJSON)
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

SCHEDULER.every '5m', :first_in => 0 do |job|
	traffic = getTrafficData()
	situation = getTrafficSituation(traffic)
	lines = getLinesInformations(traffic)
	send_event('rer_traffic', { :situation => situation, :lines => lines })
  	#send_event('rer_next_train', { :text => 'normal' })
end
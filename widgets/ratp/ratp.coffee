class Dashing.Ratp extends Dashing.Widget

	ready: ->
    # This is fired when the widget is done being rendered

	onData: (data) ->
    	if data['status_icon']
    		$('i.status-icon').attr 'class', "status-icon icon-background #{data['status_icon']}"